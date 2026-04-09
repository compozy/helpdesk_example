import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { HelpdeskApiClient } from "./auth/index.js";

const openai = createOpenAI();

const SYSTEM_PROMPT = `You are a helpdesk operator assistant. You answer questions about support tickets for the operator's organization.

Rules:
- Use only data returned by the tools. Do not invent ticket ids, codes, or customer details.
- If the user asks for exhaustive lists and the listTickets result shows total is larger than the number of rows returned, say so and offer to narrow the search or paginate (offset).
- When referencing tickets, prefer the ticket code (e.g. TK-...) and id when helpful.
- Reply in the same language as the user's question.`;

/** Input shape the model must send when it wants to list tickets via the API */
const listTicketsInputSchema = z.object({
  status: z
    .array(z.string())
    .optional()
    .describe(
      "Filter by ticket status (e.g. new, assigned, closed). Can repeat in API.",
    ),
  search: z
    .string()
    .optional()
    .describe("Search in name, email, phone, description (server-side)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Page size (default 50 in tool if omitted)."),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Skip this many rows for pagination."),
});

/** Input shape for loading a single ticket by id */
const getTicketInputSchema = z.object({
  ticketId: z
    .number()
    .int()
    .positive()
    .describe("Ticket id (number from listTickets)."),
});

/** Input shape for dashboard KPIs / trends */
const getDashboardMetricsInputSchema = z.object({
  period: z
    .enum(["7d", "30d", "90d"])
    .optional()
    .describe("Defaults to backend default when omitted."),
});

function createHelpdeskTools(client: HelpdeskApiClient) {
  const listTicketsTool = tool({
    description:
      "List tickets for the organization. Supports filtering by status, optional text search, limit and offset for pagination. Response includes data (rows) and total count.",
    inputSchema: listTicketsInputSchema,
    execute: async (input) => {
      const limit = input.limit ?? 50;
      return client.listTickets({
        status: input.status,
        search: input.search,
        limit,
        offset: input.offset,
      });
    },
  });

  const getTicketTool = tool({
    description:
      "Get full ticket detail by numeric id: status, description, comments, attachments metadata, assignment history.",
    inputSchema: getTicketInputSchema,
    execute: async ({ ticketId }) => client.getTicket(ticketId),
  });

  const getDashboardMetricsTool = tool({
    description:
      "Organization dashboard metrics and trends for a period (7d, 30d, or 90d). Use for volume, KPIs, trends.",
    inputSchema: getDashboardMetricsInputSchema,
    execute: async (input) => client.getDashboardMetrics(input.period),
  });

  return {
    listTickets: listTicketsTool,
    getTicket: getTicketTool,
    getDashboardMetrics: getDashboardMetricsTool,
  };
}

export async function runHelpdeskQuestion(
  client: HelpdeskApiClient,
  userQuestion: string,
): Promise<string> {
  const tools = createHelpdeskTools(client);
  const model = openai(process.env.OPENAI_MODEL?.trim() || "gpt-5.4-nano");

  const { text } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: userQuestion,
    stopWhen: stepCountIs(12),
    tools,
  });

  return text.trim() || "(No text response from model.)";
}
