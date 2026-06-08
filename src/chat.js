import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { chat } from "./claude.js";
import { buildSystemPrompt } from "./prompt.js";
import { itemsToCsv } from "./csv.js";
import {
  extractPlanFromMessage,
  stripPlanBlock,
  formatPlanSummary,
  getPlanItems,
} from "./plan.js";

async function promptExport(rl, plan, { defaultAction } = {}) {
  console.log("\n── Playlist ready ──");
  console.log(formatPlanSummary(plan));
  console.log("\n[e] Export CSV  [j] Show JSON  [n] Keep chatting");

  const raw = (await rl.question(defaultAction ? `> [${defaultAction}] ` : "> "))
    .trim()
    .toLowerCase();
  const answer = raw || (defaultAction ?? "n");

  if (answer === "n" || answer === "no") {
    console.log("Okay — keep refining the playlist.\n");
    return { exit: false };
  }

  if (answer === "e" || answer === "export") {
    console.log("\n" + itemsToCsv(getPlanItems(plan)) + "\n");
    return { exit: false, plan };
  }

  if (answer === "j" || answer === "json") {
    console.log("\n" + JSON.stringify(getPlanItems(plan), null, 2) + "\n");
    return { exit: false, plan };
  }

  return { exit: false, plan };
}

export async function runChat() {
  const rl = createInterface({ input, output });

  console.log("Mixly — chat mode");
  console.log("Design a playlist with Claude, then export it.\n");
  console.log("Commands: /quit  /export (re-export last playlist)\n");

  const systemPrompt = buildSystemPrompt();

  const messages = [];
  let lastAssistantText = "";
  let lastPlan = null;

  const opening = await chat(
    [
      {
        role: "user",
        content:
          "Start the session. Ask what kind of playlist they want and what vibe they're going for.",
      },
    ],
    systemPrompt
  );

  lastAssistantText = opening;
  console.log(`\nClaude: ${stripPlanBlock(opening)}\n`);

  const openingPlan = extractPlanFromMessage(opening);
  if (openingPlan) {
    lastPlan = openingPlan;
    await promptExport(rl, openingPlan);
  }

  while (true) {
    const line = (await rl.question("You: ")).trim();

    if (!line) continue;
    if (line === "/quit" || line === "/exit") break;

    if (line === "/export") {
      const plan = lastPlan ?? extractPlanFromMessage(lastAssistantText);
      if (!plan) {
        console.log(
          "No saved playlist yet. Finish one with Claude first, then /export.\n"
        );
        continue;
      }
      await promptExport(rl, plan, { defaultAction: "e" });
      continue;
    }

    messages.push({ role: "user", content: line });

    const reply = await chat(messages, systemPrompt);
    messages.push({ role: "assistant", content: reply });
    lastAssistantText = reply;

    const visible = stripPlanBlock(reply);
    if (visible) console.log(`\nClaude: ${visible}`);

    const plan = extractPlanFromMessage(reply);
    if (plan) {
      lastPlan = plan;
      await promptExport(rl, plan);
      console.log("");
    } else {
      console.log("");
    }
  }

  rl.close();
  console.log("Bye.");
}
