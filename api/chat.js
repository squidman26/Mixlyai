import { chat } from "../src/claude.js";
import { buildSystemPrompt } from "../src/prompt.js";
import {
  extractPlanFromMessage,
  stripPlanBlock,
  formatPlanSummary,
} from "../src/plan.js";
import {
  getSession,
  json,
  readJsonBody,
  requireAppSession,
  requireMethod,
} from "../lib/api.js";
export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  const { session } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  try {
    const body = await readJsonBody(req);
    const messages = body.messages;
    if (!Array.isArray(messages)) {
      json(res, 400, { error: "messages array required" });
      return;
    }

    const systemPrompt = buildSystemPrompt();
    const reply = await chat(messages, systemPrompt);
    const plan = extractPlanFromMessage(reply);
    const visible = stripPlanBlock(reply);

    json(res, 200, {
      reply: visible,
      fullReply: reply,
      plan: plan
        ? {
            ...plan,
            summary: formatPlanSummary(plan),
          }
        : null,
    });
  } catch (err) {
    const message = err.message || "Chat failed";
    if (/Missing env: ANTHROPIC_API_KEY/i.test(message)) {
      json(res, 503, {
        error: "Chat is not configured. Add ANTHROPIC_API_KEY in Vercel environment variables.",
      });
      return;
    }
    json(res, 500, { error: message });
  }
}
