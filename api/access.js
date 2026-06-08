import { json, requireMethod } from "../lib/api.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!requireMethod(req, res, "GET")) return;
    json(res, 200, {
      enabled: false,
      unlocked: true,
    });
    return;
  }

  json(res, 405, { error: "Method not allowed" });
}
