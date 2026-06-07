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
  respondInsufficientCredits,
} from "../lib/api.js";
import { requireAccess } from "../lib/gate.js";
import { CREDIT_COSTS, deductCredits } from "../lib/credits.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  const { session } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  try {
    const body = await readJsonBody(req);
    const messages = body.messages;
    if (!Array.isArray(messages)) {
      json(res, 400, { error: "messages array required" });
      return;
    }

    const creditResult = await deductCredits(
      session.accountId,
      CREDIT_COSTS.chatMessage,
      null
    );
    if (!creditResult.ok) {
      respondInsufficientCredits(res, creditResult);
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
      credits: creditResult.unlimited ? null : creditResult.credits,
      unlimitedCredits: creditResult.unlimited,
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
