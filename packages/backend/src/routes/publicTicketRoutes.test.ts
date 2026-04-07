import request from "supertest";
import { app } from "../index";
import {
  closeTestDatabase,
  testDb,
  truncateTables,
  verifyTestDatabaseConnection,
} from "../data/testHelper";

async function createOrganization(name: string, slug?: string) {
  const orgSlug = slug ?? name.toLowerCase().replace(/\s+/g, "-");
  return testDb.one<{ id: number; name: string; slug: string }>(
    "INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug",
    [name, orgSlug],
  );
}

async function createTicketType(organizationId: number, name: string) {
  return testDb.one<{ id: number }>(
    "INSERT INTO ticket_types (name, organization_id) VALUES ($1, $2) RETURNING id",
    [name, organizationId],
  );
}

async function insertTicket(
  organizationId: number,
  code: string,
  overrides: Record<string, unknown> = {},
) {
  const defaults = {
    name: "Test User",
    email: "test@example.com",
    phone: "+5511999999999",
    description: "Test description",
  };
  const data = { ...defaults, ...overrides };
  return testDb.one<{ id: number; code: string }>(
    `INSERT INTO tickets (code, name, email, phone, description, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, code`,
    [code, data.name, data.email, data.phone, data.description, organizationId],
  );
}

describe("/api/public/:orgSlug/tickets", () => {
  beforeAll(async () => {
    await verifyTestDatabaseConnection();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  afterAll(async () => {
    await truncateTables();
    await closeTestDatabase();
  });

  describe("POST /api/public/:orgSlug/tickets", () => {
    it("returns 201 with ticket code when valid data is provided", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");

      const response = await request(app)
        .post(`/api/public/${org.slug}/tickets`)
        .send({
          name: "John Doe",
          email: "john@example.com",
          phone: "+5511999999999",
          description: "I need help with my account",
        });

      expect(response.status).toBe(201);
      expect(response.body.code).toMatch(/^TK-[A-Z0-9]{8}$/);
      expect(response.body.message).toBe("Ticket created successfully");
    });

    it("returns 201 with optional ticketTypeId and attachments", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");
      const ticketType = await createTicketType(org.id, "Support");

      const response = await request(app)
        .post(`/api/public/${org.slug}/tickets`)
        .send({
          name: "Jane Doe",
          email: "jane@example.com",
          phone: "+5511888888888",
          description: "Issue with billing",
          ticketTypeId: ticketType.id,
          attachments: [
            {
              filename: "screenshot.png",
              contentType: "image/png",
              content: "aGVsbG8gd29ybGQ=",
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.code).toMatch(/^TK-[A-Z0-9]{8}$/);
      expect(response.body.message).toBe("Ticket created successfully");
    });

    it("returns 400 when name is missing", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");

      const response = await request(app)
        .post(`/api/public/${org.slug}/tickets`)
        .send({
          email: "john@example.com",
          phone: "+5511999999999",
          description: "Some issue",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Name is required");
    });

    it("returns 400 when email is missing", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");

      const response = await request(app)
        .post(`/api/public/${org.slug}/tickets`)
        .send({
          name: "John Doe",
          phone: "+5511999999999",
          description: "Some issue",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email is required");
    });

    it("returns 400 when phone is missing", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");

      const response = await request(app)
        .post(`/api/public/${org.slug}/tickets`)
        .send({
          name: "John Doe",
          email: "john@example.com",
          description: "Some issue",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Phone is required");
    });

    it("returns 400 when description is missing", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");

      const response = await request(app)
        .post(`/api/public/${org.slug}/tickets`)
        .send({
          name: "John Doe",
          email: "john@example.com",
          phone: "+5511999999999",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Description is required");
    });

    it("returns 404 when org slug is invalid", async () => {
      const response = await request(app)
        .post("/api/public/nonexistent-org/tickets")
        .send({
          name: "John Doe",
          email: "john@example.com",
          phone: "+5511999999999",
          description: "Some issue",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Organization not found");
    });

    it("returns 400 when attachment exceeds maximum size", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");
      const oversizedContent = "A".repeat(1_400_000);

      const response = await request(app)
        .post(`/api/public/${org.slug}/tickets`)
        .send({
          name: "John Doe",
          email: "john@example.com",
          phone: "+5511999999999",
          description: "Issue with large file",
          attachments: [
            {
              filename: "large-file.bin",
              contentType: "application/octet-stream",
              content: oversizedContent,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Attachment exceeds maximum size of 1MB");
    });

    it("does not require authentication", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");

      const response = await request(app)
        .post(`/api/public/${org.slug}/tickets`)
        .send({
          name: "John Doe",
          email: "john@example.com",
          phone: "+5511999999999",
          description: "No auth needed",
        });

      expect(response.status).toBe(201);
    });
  });

  describe("GET /api/public/:orgSlug/tickets/:code", () => {
    it("returns 200 with status info for a valid ticket code", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");
      const ticket = await insertTicket(org.id, "TK-ABCD1234");

      const response = await request(app)
        .get(`/api/public/${org.slug}/tickets/${ticket.code}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        code: "TK-ABCD1234",
        status: "new",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("returns 404 when ticket code does not exist", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");

      const response = await request(app)
        .get(`/api/public/${org.slug}/tickets/TK-NOTFOUND`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Ticket not found");
    });

    it("returns 404 when org slug does not match ticket organization", async () => {
      const org1 = await createOrganization("Acme Corp", "acme-corp");
      const org2 = await createOrganization("Other Corp", "other-corp");
      await insertTicket(org1.id, "TK-ORG1ONLY");

      const response = await request(app)
        .get(`/api/public/${org2.slug}/tickets/TK-ORG1ONLY`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Ticket not found");
    });

    it("returns 404 when org slug is invalid", async () => {
      const response = await request(app)
        .get("/api/public/nonexistent-org/tickets/TK-ABCD1234");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Organization not found");
    });

    it("does not require authentication", async () => {
      const org = await createOrganization("Acme Corp", "acme-corp");
      await insertTicket(org.id, "TK-NOAUTH01");

      const response = await request(app)
        .get(`/api/public/${org.slug}/tickets/TK-NOAUTH01`);

      expect(response.status).toBe(200);
    });
  });
});
