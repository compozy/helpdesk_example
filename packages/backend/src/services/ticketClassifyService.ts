import { db } from "../data/database";
import {
  extractOutputText,
  postOpenAiResponses,
  TicketClassifyExternalError,
} from "./openaiResponsesClient";
import {
  list as listTicketTypes,
  NotFoundError,
  type TicketType,
  ValidationError,
} from "./ticketTypeService";

export { TicketClassifyExternalError };

export const SENTIMENT_VALUES = ["positive", "neutral", "negative"] as const;
export type SentimentValue = (typeof SENTIMENT_VALUES)[number];

export interface ClassifyTicketTypeResult {
  ticketTypeId: number;
  ticketTypeName: string;
}

export interface ClassifySentimentResult {
  sentiment: SentimentValue;
}

interface TicketForClassification {
  id: number;
  name: string;
  email: string;
  description: string;
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function buildUserPrompt(
  ticket: TicketForClassification,
  types: TicketType[],
): string {
  const typesBlock = types
    .map((tt) => {
      const desc = tt.description ? ` — ${tt.description}` : "";
      return `- id ${tt.id}: ${tt.name}${desc}`;
    })
    .join("\n");

  return [
    "Choose exactly one ticket_type_id from the list below that best matches the support ticket.",
    "Use only an id that appears in the list.",
    "",
    "Available ticket types:",
    typesBlock,
    "",
    "Ticket:",
    `Name: ${ticket.name}`,
    `Email: ${ticket.email}`,
    `Description:\n${ticket.description}`,
  ].join("\n");
}

function buildJsonSchema(allowedIds: number[]) {
  return {
    type: "object",
    properties: {
      ticket_type_id: {
        type: "integer",
        enum: allowedIds,
        description: "The id of the single best-matching ticket type",
      },
    },
    required: ["ticket_type_id"],
    additionalProperties: false,
  } as const;
}

function buildSentimentUserPrompt(ticket: TicketForClassification): string {
  return [
    "Classify the emotional tone of the customer who opened this support ticket.",
    "Focus on how the customer sounds in the description (frustrated, neutral, appreciative, etc.).",
    "Reply with exactly one sentiment label matching the schema.",
    "",
    "Ticket:",
    `Name: ${ticket.name}`,
    `Email: ${ticket.email}`,
    `Description:\n${ticket.description}`,
  ].join("\n");
}

function buildSentimentJsonSchema() {
  return {
    type: "object",
    properties: {
      sentiment: {
        type: "string",
        enum: [...SENTIMENT_VALUES],
        description: "Customer emotional tone in the ticket text",
      },
    },
    required: ["sentiment"],
    additionalProperties: false,
  } as const;
}

export async function classifyAndPersistTicketType(
  ticketId: number,
  organizationId: number,
): Promise<ClassifyTicketTypeResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TicketClassifyExternalError("OpenAI API key is not configured");
  }

  const ticket = await db.oneOrNone<TicketForClassification>(
    `SELECT id, name, email, description
     FROM tickets
     WHERE id = $1 AND organization_id = $2`,
    [ticketId, organizationId],
  );

  if (!ticket) {
    throw new NotFoundError("Ticket not found");
  }

  const types = await listTicketTypes(organizationId);
  if (types.length === 0) {
    throw new ValidationError("No ticket types defined for this organization");
  }

  const allowedIds = types.map((t) => t.id);
  const schema = buildJsonSchema(allowedIds);

  const body = {
    model: getModel(),
    instructions:
      "You classify support tickets into exactly one organizational ticket type. Reply only with structured JSON matching the schema.",
    input: buildUserPrompt(ticket, types),
    text: {
      format: {
        type: "json_schema",
        name: "ticket_type_pick",
        description: "Pick the best ticket_type_id for the ticket",
        schema,
        strict: true,
      },
    },
  };

  const rawJson = await postOpenAiResponses(apiKey, body);
  const textOut = extractOutputText(rawJson);
  let parsed: { ticket_type_id?: unknown };
  try {
    parsed = JSON.parse(textOut) as { ticket_type_id?: unknown };
  } catch {
    throw new TicketClassifyExternalError(
      "Could not parse classification result",
    );
  }

  const ticketTypeId = parsed.ticket_type_id;
  if (typeof ticketTypeId !== "number" || !Number.isInteger(ticketTypeId)) {
    throw new TicketClassifyExternalError("Invalid classification result");
  }

  if (!allowedIds.includes(ticketTypeId)) {
    throw new TicketClassifyExternalError(
      "Classification returned an unknown ticket type",
    );
  }

  const typeRow = types.find((t) => t.id === ticketTypeId);
  if (!typeRow) {
    throw new TicketClassifyExternalError(
      "Classification returned an unknown ticket type",
    );
  }

  await db.none(
    `UPDATE tickets SET ticket_type_id = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [ticketTypeId, ticketId, organizationId],
  );

  return { ticketTypeId, ticketTypeName: typeRow.name };
}

export async function classifyAndPersistSentiment(
  ticketId: number,
  organizationId: number,
): Promise<ClassifySentimentResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TicketClassifyExternalError("OpenAI API key is not configured");
  }

  const ticket = await db.oneOrNone<TicketForClassification>(
    `SELECT id, name, email, description
     FROM tickets
     WHERE id = $1 AND organization_id = $2`,
    [ticketId, organizationId],
  );

  if (!ticket) {
    throw new NotFoundError("Ticket not found");
  }

  const schema = buildSentimentJsonSchema();
  const body = {
    model: getModel(),
    instructions:
      "You classify customer sentiment in support tickets. Reply only with structured JSON matching the schema.",
    input: buildSentimentUserPrompt(ticket),
    text: {
      format: {
        type: "json_schema",
        name: "ticket_sentiment",
        description: "Customer sentiment for the ticket",
        schema,
        strict: true,
      },
    },
  };

  const rawJson = await postOpenAiResponses(apiKey, body);
  const textOut = extractOutputText(rawJson);
  let parsed: { sentiment?: unknown };
  try {
    parsed = JSON.parse(textOut) as { sentiment?: unknown };
  } catch {
    throw new TicketClassifyExternalError(
      "Could not parse classification result",
    );
  }

  const sentimentRaw = parsed.sentiment;
  if (typeof sentimentRaw !== "string") {
    throw new TicketClassifyExternalError("Invalid classification result");
  }

  if (!SENTIMENT_VALUES.includes(sentimentRaw as SentimentValue)) {
    throw new TicketClassifyExternalError(
      "Classification returned an unknown sentiment",
    );
  }

  const sentiment = sentimentRaw as SentimentValue;

  await db.none(
    `UPDATE tickets SET sentiment = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [sentiment, ticketId, organizationId],
  );

  return { sentiment };
}
