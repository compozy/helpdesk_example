export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export class TicketClassifyExternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketClassifyExternalError";
  }
}

export function extractOutputText(data: unknown): string {
  if (typeof data !== "object" || data === null) {
    throw new TicketClassifyExternalError(
      "Invalid response from classification service",
    );
  }
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    throw new TicketClassifyExternalError(
      "Invalid response from classification service",
    );
  }
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    if ((item as { type?: string }).type !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      if ((part as { type?: string }).type === "output_text") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string" && text.length > 0) {
          return text;
        }
      }
    }
  }
  throw new TicketClassifyExternalError(
    "No model output in classification response",
  );
}

export async function postOpenAiResponses(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new TicketClassifyExternalError(
      "Could not reach classification service",
    );
  }

  let rawJson: unknown;
  try {
    rawJson = await response.json();
  } catch {
    throw new TicketClassifyExternalError(
      "Invalid response from classification service",
    );
  }

  if (!response.ok) {
    throw new TicketClassifyExternalError(
      "Classification request was rejected",
    );
  }

  if (typeof rawJson === "object" && rawJson !== null) {
    const status = (rawJson as { status?: string }).status;
    const err = (rawJson as { error?: { message?: string } }).error;
    if (status && status !== "completed") {
      throw new TicketClassifyExternalError("Classification did not complete");
    }
    if (err?.message) {
      throw new TicketClassifyExternalError("Classification request failed");
    }
  }

  return rawJson;
}
