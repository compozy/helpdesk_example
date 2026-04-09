import { defineCommand } from "citty";
import { clearCachedToken, getTokenCachePath } from "../lib/auth/index.js";

export const logoutCommand = defineCommand({
  meta: {
    name: "logout",
    description: "Remove saved session token from disk (HELPDESK_TOKEN env is unchanged).",
  },
  async run() {
    try {
      const removed = await clearCachedToken();
      if (removed) {
        console.error(`Session cleared: ${getTokenCachePath()}`);
      } else {
        console.error("No session file was present.");
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  },
});
