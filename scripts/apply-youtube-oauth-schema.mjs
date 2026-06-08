#!/usr/bin/env node
/**
 * @deprecated Use scripts/apply-pending-schema.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "apply-pending-schema.mjs");
const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
