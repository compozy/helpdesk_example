import {
  extractOutputText,
  postOpenAiResponses,
  TicketClassifyExternalError,
} from "./openaiResponsesClient";
import { ValidationError } from "./ticketTypeService";

function getAttachmentValidationModel(): string {
  return (
    process.env.OPENAI_ATTACHMENT_VALIDATION_MODEL?.trim() || "gpt-5.4-nano"
  );
}

function buildImageValidationSchema() {
  return {
    type: "object",
    properties: {
      valid_for_support_ticket: {
        type: "boolean",
        description:
          "True if the image is appropriate for a support ticket (e.g. screenshot, error photo, relevant UI) and aligns with the ticket description",
      },
      rejection_reason: {
        type: "string",
        description:
          "When valid_for_support_ticket is false, a clear reason why; must be empty string when valid_for_support_ticket is true",
      },
    },
    required: ["valid_for_support_ticket", "rejection_reason"],
    additionalProperties: false,
  } as const;
}

function buildMultimodalInput(
  description: string,
  filename: string,
  contentType: string,
  base64Content: string,
): Record<string, unknown>[] {
  const dataUrl = `data:${contentType};base64,${base64Content}`;
  const userText = [
    "You validate images attached to a new customer support ticket.",
    "Decide if this image is suitable for support (e.g. screenshots, error messages, product/UI issues, readable documents related to the problem).",
    "Reject irrelevant content (memes, unrelated photos, spam, personal images with no link to the issue, etc.).",
    "Also check that the image content correlates with the ticket description below.",
    "",
    `Ticket description:\n${description}`,
    "",
    `Attachment filename: ${filename}`,
  ].join("\n");

  return [
    {
      role: "user",
      content: [
        { type: "input_text", text: userText },
        { type: "input_image", image_url: dataUrl },
      ],
    },
  ];
}

export async function validateSupportTicketImages(
  description: string,
  attachments:
    | ReadonlyArray<{ filename: string; contentType: string; content: string }>
    | undefined,
): Promise<void> {
  if (!attachments?.length) return;

  const imageAttachments = attachments.filter((a) =>
    a.contentType.toLowerCase().startsWith("image/"),
  );
  if (imageAttachments.length === 0) return;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TicketClassifyExternalError("OpenAI API key is not configured");
  }

  const schema = buildImageValidationSchema();
  const model = getAttachmentValidationModel();

  for (const attachment of imageAttachments) {
    const body = {
      model,
      instructions:
        "You validate support-ticket image attachments. Reply only with structured JSON matching the schema. Set rejection_reason to an empty string when valid_for_support_ticket is true.",
      input: buildMultimodalInput(
        description,
        attachment.filename,
        attachment.contentType,
        attachment.content,
      ),
      text: {
        format: {
          type: "json_schema",
          name: "support_ticket_image_validation",
          description:
            "Whether the image is valid for a support ticket and why it may be rejected",
          schema,
          strict: true,
        },
      },
    };

    const rawJson = await postOpenAiResponses(apiKey, body);
    const textOut = extractOutputText(rawJson);
    let parsed: {
      valid_for_support_ticket?: unknown;
      rejection_reason?: unknown;
    };
    try {
      parsed = JSON.parse(textOut) as {
        valid_for_support_ticket?: unknown;
        rejection_reason?: unknown;
      };
    } catch {
      throw new TicketClassifyExternalError(
        "Could not parse classification result",
      );
    }

    const valid = parsed.valid_for_support_ticket;
    const reasonRaw = parsed.rejection_reason;
    if (typeof valid !== "boolean") {
      throw new TicketClassifyExternalError("Invalid classification result");
    }
    if (typeof reasonRaw !== "string") {
      throw new TicketClassifyExternalError("Invalid classification result");
    }

    if (!valid) {
      const reason =
        reasonRaw.trim() ||
        "The image was not accepted for this support ticket.";
      throw new ValidationError(
        `Image "${attachment.filename}" was rejected: ${reason}`,
      );
    }
  }
}
