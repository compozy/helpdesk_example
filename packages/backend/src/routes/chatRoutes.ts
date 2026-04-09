import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import {
  authMiddleware,
  type AuthenticatedRequest,
} from "../data/authMiddleware";
import { getClassificationModel } from "../services/aiModels";
import { listTickets, getTicketById } from "../services/ticketService";
import { getDashboardMetrics } from "../services/dashboardService";

const SYSTEM_PROMPT = `You are a helpdesk operator assistant. You answer questions about support tickets for the operator's organization.

Rules:
- Use only data returned by the tools. Do not invent ticket ids, codes, or customer details.
- If the user asks for exhaustive lists and the listTickets result shows total is larger than the number of rows returned, say so and offer to narrow the search or paginate (offset).
- When referencing tickets, prefer the ticket code (e.g. TK-...) and id when helpful.
- Reply in the same language as the user's question.`;

export const chatRoutes = Router();
chatRoutes.use(authMiddleware);

chatRoutes.post(
  "/messages",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = (req as AuthenticatedRequest).user;
      const { messages } = req.body as { messages: UIMessage[] };
      const modelMessages = await convertToModelMessages(messages);

      const result = streamText({
        model: getClassificationModel(),
        system: SYSTEM_PROMPT,
        messages: modelMessages,
        stopWhen: stepCountIs(12),
        tools: {
          listTickets: tool({
            description:
              "List tickets for the organization. Supports filtering by status, optional text search, limit and offset for pagination. Response includes data (rows) and total count.",
            inputSchema: z.object({
              status: z
                .array(z.string())
                .optional()
                .describe("Filter by ticket status (e.g. new, assigned, closed)."),
              search: z
                .string()
                .optional()
                .describe("Search in name, email, phone, description."),
              limit: z
                .number()
                .int()
                .min(1)
                .max(100)
                .optional()
                .describe("Page size (default 50)."),
              offset: z
                .number()
                .int()
                .min(0)
                .optional()
                .describe("Skip this many rows for pagination."),
            }),
            execute: async (input) => {
              const limit = input.limit ?? 50;
              return listTickets(
                organizationId,
                input.status,
                input.search,
                limit,
                input.offset,
              );
            },
          }),
          getTicket: tool({
            description:
              "Get full ticket detail by numeric id: status, description, comments, attachments metadata, assignment history.",
            inputSchema: z.object({
              ticketId: z
                .number()
                .int()
                .positive()
                .describe("Ticket id (number from listTickets)."),
            }),
            execute: async ({ ticketId }) =>
              getTicketById(ticketId, organizationId),
          }),
          getDashboardMetrics: tool({
            description:
              "Organization dashboard metrics and trends for a period (7d, 30d, or 90d). Use for volume, KPIs, trends.",
            inputSchema: z.object({
              period: z
                .enum(["7d", "30d", "90d"])
                .optional()
                .describe("Defaults to backend default when omitted."),
            }),
            execute: async (input) =>
              getDashboardMetrics(organizationId, input.period),
          }),
        },
      });

      result.pipeUIMessageStreamToResponse(res);
    } catch (error) {
      next(error);
    }
  },
);
