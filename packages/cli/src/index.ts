#!/usr/bin/env bun
import "dotenv/config";
import { defineCommand, runMain } from "citty";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { questionCommand } from "./commands/question.js";

const main = defineCommand({
  meta: {
    name: "helpdesk",
    version: "0.1.0",
    description: "Helpdesk operator CLI: ask questions about tickets via AI and the backend API.",
  },
  subCommands: {
    question: questionCommand,
    login: loginCommand,
    logout: logoutCommand,
  },
});

runMain(main);
