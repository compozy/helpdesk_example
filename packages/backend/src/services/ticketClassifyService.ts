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

export interface TicketClassificationInput {
  name: string;
  email: string;
  description: string;
}

function buildUserPrompt(
  ticket: TicketClassificationInput,
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

function buildSentimentUserPrompt(ticket: TicketClassificationInput): string {
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

export async function classifyTicketType(
  ticket: TicketClassificationInput,
  types: TicketType[],
): Promise<ClassifyTicketTypeResult> {
  const allowedIds = types.map((t) => t.id);
  const schema = z.object({
    ticket_type_id: z.number().int(),
  });

  const result = await generateText({
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

  const ticketTypeId = result.output?.ticket_type_id;
  if (!ticketTypeId || !allowedIds.includes(ticketTypeId)) {
    throw new TicketClassifyExternalError(
      "Classification returned an unknown ticket type",
    );
  }

  const typeRow = types.find((t) => t.id === ticketTypeId)!;
  return { ticketTypeId, ticketTypeName: typeRow.name };
}

export async function classifySentiment(
  ticket: TicketClassificationInput,
): Promise<ClassifySentimentResult> {
  const result = await generateText({
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

  const sentiment = result.output;
  if (!sentiment || !SENTIMENT_VALUES.includes(sentiment)) {
    throw new TicketClassifyExternalError("Invalid classification result");
  }

  return { sentiment };
}

export async function classifyAndPersistTicketType(
  ticketId: number,
  organizationId: number,
): Promise<ClassifyTicketTypeResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TicketClassifyExternalError("OpenAI API key is not configured");
  }

  const ticket = await db.oneOrNone<TicketClassificationInput>(
    `SELECT name, email, description
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

  let classification: ClassifyTicketTypeResult;
  try {
    classification = await classifyTicketType(ticket, types);
  } catch {
    throw new TicketClassifyExternalError("Classification request failed");
  }

  await db.none(
    `UPDATE tickets SET ticket_type_id = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [classification.ticketTypeId, ticketId, organizationId],
  );

  return classification;
}

export async function classifyAndPersistSentiment(
  ticketId: number,
  organizationId: number,
): Promise<ClassifySentimentResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TicketClassifyExternalError("OpenAI API key is not configured");
  }

  const ticket = await db.oneOrNone<TicketClassificationInput>(
    `SELECT name, email, description
     FROM tickets
     WHERE id = $1 AND organization_id = $2`,
    [ticketId, organizationId],
  );

  if (!ticket) {
    throw new NotFoundError("Ticket not found");
  }

  let classification: ClassifySentimentResult;
  try {
    classification = await classifySentiment(ticket);
  } catch {
    throw new TicketClassifyExternalError("Classification request failed");
  }

  await db.none(
    `UPDATE tickets SET sentiment = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [classification.sentiment, ticketId, organizationId],
  );

  return classification;
}
