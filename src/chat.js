import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import fs from "fs";
import path from "path";
import { chat } from "./claude.js";
import { buildSystemPrompt } from "./prompt.js";
import {
  extractPlanFromMessage,
  stripPlanBlock,
  formatPlanSummary,
} from "./plan.js";
import { applyPlan } from "./manager.js";
import { getUserPlaylists } from "./music-cli.js";
import { getProviderName } from "../lib/music.js";

const TOKEN_FILE = path.join(process.cwd(), ".mixly-tokens.json");

function hasTokens(provider) {
  if (!fs.existsSync(TOKEN_FILE)) return false;
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    return tokens.provider === provider;
  } catch {
    return false;
  }
}

async function loadPlaylistContext(provider) {
  if (!hasTokens(provider)) return [];
  try {
    return await getUserPlaylists(provider, 30);
  } catch {
    return [];
  }
}

async function promptApply(rl, plan, provider, { defaultAction } = {}) {
  const providerName = getProviderName(provider);
  console.log("\n── Playlist ready ──");
  console.log(formatPlanSummary(plan));
  console.log(`\n[y] Apply to ${providerName}  [d] Dry run (match only)  [n] Keep chatting`);

  const raw = (await rl.question(defaultAction ? `> [${defaultAction}] ` : "> "))
    .trim()
    .toLowerCase();
  const answer = raw || (defaultAction ?? "n");

  if (answer === "n" || answer === "no") {
    console.log("Okay — keep refining the playlist.\n");
    return { exit: false };
  }

  if (!hasTokens(provider)) {
    console.error(`\nNot logged in to ${providerName}. Run: npm run auth -- --provider ${provider}\n`);
    return { exit: false };
  }

  const opts = {
    provider,
    dryRun: answer === "d" || answer === "dry" || answer === "dry-run",
    includeAmbiguous: false,
  };

  const includeAmbiguous = await rl.question(
    "Include uncertain matches? [y/N] "
  );
  opts.includeAmbiguous = /^y/i.test(includeAmbiguous.trim());

  try {
    await applyPlan(plan, opts);
    if (opts.dryRun) {
      console.log(
        "\nDry run finished. Type /apply to apply for real, or keep chatting.\n"
      );
      return { exit: false, plan };
    }
    return { exit: true, plan };
  } catch (err) {
    console.error(`\nError: ${err.message}\n`);
    return { exit: false, plan };
  }
}

export async function runChat(provider = "youtube") {
  const rl = createInterface({ input, output });
  const providerName = getProviderName(provider);

  console.log("Mixly — chat mode");
  console.log(`Design a playlist with Claude, then apply it to ${providerName}.\n`);
  console.log(
    "Commands: /quit  /apply (re-run last playlist — apply or dry run again)\n"
  );

  const playlists = await loadPlaylistContext(provider);
  const systemPrompt = buildSystemPrompt({ playlists, provider });

  const messages = [];
  let lastAssistantText = "";
  let lastPlan = null;

  const opening = await chat(
    [
      {
        role: "user",
        content:
          "Start the session. Ask whether I want to create a new playlist or edit an existing one, and what vibe I'm going for.",
      },
    ],
    systemPrompt
  );

  lastAssistantText = opening;
  console.log(`\nClaude: ${stripPlanBlock(opening)}\n`);

  const openingPlan = extractPlanFromMessage(opening);
  if (openingPlan) {
    lastPlan = openingPlan;
    const { exit } = await promptApply(rl, openingPlan, provider);
    if (exit) {
      rl.close();
      return;
    }
  }

  while (true) {
    const line = (await rl.question("You: ")).trim();

    if (!line) continue;
    if (line === "/quit" || line === "/exit") break;

    if (line === "/apply") {
      const plan =
        lastPlan ?? extractPlanFromMessage(lastAssistantText);
      if (!plan) {
        console.log(
          "No saved playlist yet. Finish one with Claude first, then /apply.\n"
        );
        continue;
      }
      const { exit } = await promptApply(rl, plan, provider, { defaultAction: "y" });
      if (exit) break;
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
      const { exit } = await promptApply(rl, plan, provider);
      if (exit) break;
      console.log("");
    } else {
      console.log("");
    }
  }

  rl.close();
  console.log("Bye.");
}
