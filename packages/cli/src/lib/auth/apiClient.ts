const jsonHeaders = {
  "Content-Type": "application/json",
} as const;

export type Period = "7d" | "30d" | "90d";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class HelpdeskApiClient {
  constructor(
    private readonly baseUrl: string,
    private getToken: () => Promise<string>,
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      ...jsonHeaders,
    };
  }

  static async signin(
    baseUrl: string,
    email: string,
    password: string,
  ): Promise<string> {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/signin`, {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ email, password }),
    });
    const data = await readResponse(res);
    if (!res.ok) {
      const body = typeof data === "string" ? data : JSON.stringify(data);
      throw new ApiError(`Sign-in failed: ${res.status}`, res.status, body);
    }
    if (
      typeof data === "object" &&
      data !== null &&
      "token" in data &&
      typeof (data as { token: unknown }).token === "string"
    ) {
      return (data as { token: string }).token;
    }
    throw new ApiError("Sign-in response missing token", res.status, String(data));
  }

  async listTickets(params: {
    status?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/api/tickets`);
    if (params.status?.length) {
      for (const s of params.status) {
        url.searchParams.append("status", s);
      }
    }
    if (params.search) url.searchParams.set("search", params.search);
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));

    const res = await fetch(url, { headers: await this.authHeaders() });
    const data = await readResponse(res);
    if (!res.ok) {
      throw new ApiError(`listTickets failed: ${res.status}`, res.status, String(data));
    }
    return data;
  }

  async getTicket(ticketId: number): Promise<unknown> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/tickets/${ticketId}`, {
      headers: await this.authHeaders(),
    });
    const data = await readResponse(res);
    if (!res.ok) {
      throw new ApiError(`getTicket failed: ${res.status}`, res.status, String(data));
    }
    return data;
  }

  async getDashboardMetrics(period?: Period): Promise<unknown> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/api/dashboard/metrics`);
    if (period) url.searchParams.set("period", period);
    const res = await fetch(url, { headers: await this.authHeaders() });
    const data = await readResponse(res);
    if (!res.ok) {
      throw new ApiError(`getDashboardMetrics failed: ${res.status}`, res.status, String(data));
    }
    return data;
  }
}
