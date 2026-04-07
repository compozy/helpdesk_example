import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TicketSummary } from "@/types/types";

type StatusFilter = "all" | "new" | "assigned" | "closed";

const VALID_STATUSES: StatusFilter[] = ["all", "new", "assigned", "closed"];
const PAGE_SIZE = 20;

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-primary/10 text-primary border-primary/20 font-semibold",
    assigned: "bg-accent/10 text-accent-foreground border-accent/20",
    closed: "bg-muted text-muted-foreground border-border",
  };
  const className = styles[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${className}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TicketsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status") as StatusFilter | null;
  const activeFilter: StatusFilter = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : "all";

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: t("tickets.all") },
    { value: "new", label: t("tickets.new") },
    { value: "assigned", label: t("tickets.assigned") },
    { value: "closed", label: t("tickets.closed") },
  ];

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  useEffect(() => {
    let isMounted = true;

    const loadOrgSlug = async () => {
      try {
        const response = await fetch("/api/organizations/current");
        if (response.ok) {
          const data = (await response.json()) as { slug: string };
          if (isMounted) setOrgSlug(data.slug);
        }
      } catch {
        // slug is supplementary
      }
    };

    void loadOrgSlug();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadTickets = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const params = new URLSearchParams();
        if (activeFilter !== "all") params.set("status", activeFilter);
        if (debouncedSearch) params.set("search", debouncedSearch);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String((currentPage - 1) * PAGE_SIZE));

        const queryString = params.toString();
        const url = `/api/tickets${queryString ? `?${queryString}` : ""}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(t("tickets.loadError"));
        }

        const result = (await response.json()) as { data: TicketSummary[]; total: number };

        if (isMounted) {
          setTickets(result.data);
          setTotal(result.total);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error ? error.message : t("tickets.loadError"),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadTickets();
    return () => { isMounted = false; };
  }, [activeFilter, debouncedSearch, currentPage]);

  const handleFilterChange = (filter: StatusFilter) => {
    if (filter === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ status: filter });
    }
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold tracking-tight">{t("tickets.title")}</h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("tickets.description")}
          </p>
        </div>
        {orgSlug && (
          <Button
            onClick={() => window.open(`/${orgSlug}/tickets/new`, "_blank")}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("tickets.newTicket")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2" role="group" aria-label="Filter by status">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={activeFilter === option.value ? "default" : "outline"}
              onClick={() => handleFilterChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="w-full md:w-80">
          <Input
            placeholder={t("tickets.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loadError ? (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
          {loadError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("tickets.code")}</TableHead>
              <TableHead>{t("tickets.customer")}</TableHead>
              <TableHead>{t("common.type")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("ticketDetail.assignee")}</TableHead>
              <TableHead>{t("common.created")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                className={ticket.status === "new" ? "bg-primary/5" : ""}
                data-testid="ticket-row"
              >
                <TableCell>
                  <Link
                    className="font-medium text-primary hover:underline"
                    to={`/tickets/${ticket.id}`}
                  >
                    {ticket.code}
                  </Link>
                </TableCell>
                <TableCell>{ticket.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ticket.ticketTypeName ?? "-"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {ticket.assignedToName ?? "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(ticket.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 border-t border-border/60 px-4 py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <span className="text-sm text-muted-foreground">
              {t("tickets.loadingTickets")}
            </span>
          </div>
        ) : null}

        {!isLoading && !loadError && tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/60 px-4 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <svg
                className="h-6 w-6 text-muted-foreground/60"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
                <path d="M14 3v4a2 2 0 0 0 2 2h4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-display text-sm font-medium text-foreground">
                {t("tickets.noTicketsFound")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("tickets.noTicketsDescription")}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {!isLoading && total > PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("tickets.showingResults", {
              from: (currentPage - 1) * PAGE_SIZE + 1,
              to: Math.min(currentPage * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={handlePreviousPage}
            >
              {t("tickets.previous")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={handleNextPage}
            >
              {t("tickets.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TicketsPage;
