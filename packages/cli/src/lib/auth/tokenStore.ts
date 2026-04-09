import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

type TokenFilePayload = {
  apiBaseUrl: string;
  token: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function getTokenCachePath(): string {
  const override = process.env.HELPDESK_TOKEN_CACHE?.trim();
  if (override) {
    return resolve(override);
  }
  const stateHome =
    process.env.XDG_STATE_HOME?.trim() || join(homedir(), ".local", "state");
  return join(stateHome, "helpdesk-cli", "token.json");
}

function decodeJwtExpSeconds(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 120): boolean {
  const exp = decodeJwtExpSeconds(token);
  if (exp === null) return false;
  return Math.floor(Date.now() / 1000) >= exp - skewSeconds;
}

export async function readCachedToken(apiBaseUrl: string): Promise<string | null> {
  const file = getTokenCachePath();
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    throw e;
  }

  let parsed: TokenFilePayload;
  try {
    parsed = JSON.parse(raw) as TokenFilePayload;
  } catch {
    return null;
  }

  if (
    typeof parsed.token !== "string" ||
    typeof parsed.apiBaseUrl !== "string" ||
    normalizeBaseUrl(parsed.apiBaseUrl) !== normalizeBaseUrl(apiBaseUrl)
  ) {
    return null;
  }

  if (isTokenExpired(parsed.token)) {
    try {
      await unlink(file);
    } catch {
      /* ignore */
    }
    return null;
  }

  return parsed.token;
}

export async function writeCachedToken(apiBaseUrl: string, token: string): Promise<void> {
  const file = getTokenCachePath();
  const dir = dirname(file);
  await mkdir(dir, { recursive: true, mode: DIR_MODE });
  const payload: TokenFilePayload = {
    apiBaseUrl: normalizeBaseUrl(apiBaseUrl),
    token,
  };
  await writeFile(file, `${JSON.stringify(payload)}\n`, { mode: FILE_MODE });
  try {
    await chmod(file, FILE_MODE);
    await chmod(dir, DIR_MODE);
  } catch {
    /* Windows etc. */
  }
}

export async function clearCachedToken(): Promise<boolean> {
  const file = getTokenCachePath();
  try {
    await unlink(file);
    return true;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return false;
    throw e;
  }
}
