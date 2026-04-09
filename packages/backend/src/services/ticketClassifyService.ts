import { generateText, Output } from "ai";
import { z } from "zod";
import { db } from "../data/database";
import { getClassificationModel } from "./aiModels";
import {
  list as listTicketTypes,
  NotFoundError,
  type TicketType,
  ValidationError,
} from "./ticketTypeService";

export class TicketClassifyExternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketClassifyExternalError";
  }
}

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
  const schema = z.object({
    ticket_type_id: z.number().int(),
  });

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: getClassificationModel(),
      output: Output.object({
        schema,
        name: "ticket_type_pick",
        description: "Pick the best ticket_type_id for the ticket",
      }),
      system:
        "You classify support tickets into exactly one organizational ticket type. Reply only with structured JSON matching the schema.",
      prompt: buildUserPrompt(ticket, types),
    });
  } catch {
    throw new TicketClassifyExternalError("Classification request failed");
  }

  const output = result.output;
  if (!output) {
    throw new TicketClassifyExternalError("Invalid classification result");
  }

  const ticketTypeId = output.ticket_type_id;
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

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: getClassificationModel(),
      output: Output.choice({
        options: [...SENTIMENT_VALUES],
        name: "ticket_sentiment",
        description: "Customer sentiment for the ticket",
      }),
      system:
        "You classify customer sentiment in support tickets. Reply only with structured JSON matching the schema.",
      prompt: buildSentimentUserPrompt(ticket),
    });
  } catch {
    throw new TicketClassifyExternalError("Classification request failed");
  }

  const sentiment = result.output;
  if (!sentiment) {
    throw new TicketClassifyExternalError("Invalid classification result");
  }

  await db.none(
    `UPDATE tickets SET sentiment = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [sentiment, ticketId, organizationId],
  );

  return { sentiment };
}
