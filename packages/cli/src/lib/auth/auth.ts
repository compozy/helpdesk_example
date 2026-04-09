import { HelpdeskApiClient } from "./apiClient.js";
import { readCachedToken, writeCachedToken } from "./tokenStore.js";

export function getBaseUrl(): string {
  return (process.env.HELPDESK_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type CredentialOverrides = {
  email?: string;
  password?: string;
  noSaveCache?: boolean;
};

/**
 * Returns an async getter that yields a Bearer token: HELPDESK_TOKEN env,
 * then session file (see tokenStore), then email + password sign-in (cached on disk unless noSaveCache).
 * Resolved token is kept in memory for the remainder of the process.
 */
export function createTokenGetter(overrides?: CredentialOverrides): () => Promise<string> {
  const fromEnv = process.env.HELPDESK_TOKEN?.trim();
  if (fromEnv) {
    return async () => fromEnv;
  }

  const baseUrl = getBaseUrl();
  const email = overrides?.email?.trim() || process.env.HELPDESK_EMAIL?.trim();
  const password = overrides?.password ?? process.env.HELPDESK_PASSWORD;
  const noSaveCache = overrides?.noSaveCache === true;
  let memory: string | undefined;

  return async () => {
    if (memory) {
      return memory;
    }

    const fromDisk = await readCachedToken(baseUrl);
    if (fromDisk) {
      memory = fromDisk;
      return memory;
    }

    if (!email || !password) {
      throw new Error(
        "No credentials: set HELPDESK_TOKEN, run `helpdesk login`, or use HELPDESK_EMAIL / HELPDESK_PASSWORD (or --email / --password).",
      );
    }

    const token = await HelpdeskApiClient.signin(baseUrl, email, password);
    if (!noSaveCache) {
      await writeCachedToken(baseUrl, token);
    }
    memory = token;
    return memory;
  };
}
