import { defineCommand } from "citty";
import { getBaseUrl, HelpdeskApiClient, writeCachedToken } from "../lib/auth/index.js";

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description:
      "Sign in; saves session for later commands and prints JWT. Use --email/--password or env.",
  },
  args: {
    email: {
      type: "string",
      alias: ["e"],
      description: "Account email (overrides HELPDESK_EMAIL).",
    },
    password: {
      type: "string",
      alias: ["p"],
      description:
        "Password (overrides HELPDESK_PASSWORD). Warning: may appear in shell history.",
    },
    noSave: {
      type: "boolean",
      description: "Do not write the session cache (only print token).",
    },
  },
  async run({ args }) {
    const email = args.email?.trim() || process.env.HELPDESK_EMAIL?.trim();
    const password = args.password ?? process.env.HELPDESK_PASSWORD;
    if (!email || !password) {
      console.error(
        "Provide --email and --password, or set HELPDESK_EMAIL and HELPDESK_PASSWORD.",
      );
      process.exitCode = 1;
      return;
    }
    try {
      const baseUrl = getBaseUrl();
      const token = await HelpdeskApiClient.signin(baseUrl, email, password);
      if (!args.noSave) {
        await writeCachedToken(baseUrl, token);
      }
      console.log(token);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  },
});
