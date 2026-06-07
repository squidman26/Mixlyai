#!/usr/bin/env node

import { Command } from "commander";
import { runChat } from "./chat.js";

const program = new Command();

program
  .name("mixly")
  .description("Chat with Claude to design music playlists");

program
  .command("chat", { isDefault: true })
  .description("Chat with Claude to design a playlist")
  .action(async () => {
    await runChat();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
