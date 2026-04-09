import { defineCommand } from "citty";
import { runHelpdeskQuestion } from "../lib/agent.js";
import { createTokenGetter, getBaseUrl, HelpdeskApiClient } from "../lib/auth/index.js";

export const questionCommand = defineCommand({
  meta: {
    name: "question",
    description: "Ask a question about tickets (AI uses backend API tools).",
  },
  args: {
    email: {
      type: "string",
      alias: ["e"],
      description: "Account email for sign-in (overrides HELPDESK_EMAIL; ignored if HELPDESK_TOKEN is set).",
    },
    password: {
      type: "string",
      alias: ["p"],
      description:
        "Password for sign-in (overrides HELPDESK_PASSWORD). Warning: may appear in shell history.",
    },
    noSave: {
      type: "boolean",
      description:
        "If signing in with email/password, do not update the session cache on disk.",
    },
    text: {
      type: "string",
      description: "Question text (for scripts; alternative to a quoted positional).",
      alias: ["t"],
    },
    prompt: {
      type: "positional",
      description: "Question; use shell quotes for multiple words, e.g. helpdesk question \"How many open?\"",
      required: false,
    },
  },
  async run({ args }) {
    const q = (args.text?.trim() || args.prompt)?.trim();
    if (!q) {
      console.error("Provide a question as a quoted argument or use --text / -t.");
      process.exitCode = 1;
      return;
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      console.error("OPENAI_API_KEY is required.");
      process.exitCode = 1;
      return;
    }
    try {
      const getToken = createTokenGetter({
        email: args.email,
        password: args.password,
        noSaveCache: args.noSave === true,
      });
      const client = new HelpdeskApiClient(getBaseUrl(), getToken);
      const answer = await runHelpdeskQuestion(client, q);
      console.log(answer);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  },
});
