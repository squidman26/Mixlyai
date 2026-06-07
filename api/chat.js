import { chat } from "../src/claude.js";
import { buildSystemPrompt } from "../src/prompt.js";
import {
  extractPlanFromMessage,
  stripPlanBlock,
  formatPlanSummary,
} from "../src/plan.js";
import { getUserPlaylists } from "../lib/spotify.js";
import {
  getSession,
  json,
  readJsonBody,
  requireMethod,
  requireSpotifySession,
  respondInsufficientCredits,
} from "../lib/api.js";
import { requireAccess } from "../lib/gate.js";
import { CREDIT_COSTS, deductCredits } from "../lib/credits.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);
  if (!requireSpotifySession(req, res, session)) return;

  if (!session.accountId) {
    json(res, 400, { error: "Account not synced yet. Refresh and try again." });
    return;
  }

  let playlists = [];

  if (session?.refresh_token) {
    try {
      const result = await getUserPlaylists(session, 30);
      save(result.session);
      playlists = result.playlists;
    } catch {
      playlists = [];
    }
  }

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
      session.user
    );
    if (!creditResult.ok) {
      respondInsufficientCredits(res, creditResult);
      return;
    }

    const systemPrompt = buildSystemPrompt({ playlists });
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
    json(res, 500, { error: err.message || "Chat failed" });
  }
}
