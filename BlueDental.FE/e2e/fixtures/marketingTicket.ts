import type { Page } from "@playwright/test";
import * as XLSX from "xlsx";

/** Marketing → Ticket (F-55) helpers shared by the API and UI specs. */

export const TICKETS = "/api/v1/app/marketing-tickets";
export const TAGS = "/api/v1/app/marketing-ticket-tags";
export const FILES = "/api/v1/app/marketing-ticket-files";
export const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
export const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

export interface Reply<T> {
  status: number;
  body: T & { error?: { code?: string } };
}

/**
 * A real request from inside the logged-in page: the session cookie and the
 * antiforgery token the server set, plus the branch header the app sends.
 */
export async function call<T>(page: Page, method: string, url: string, body?: unknown, branch = BRANCH_ONE): Promise<Reply<T>> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const init: RequestInit = {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { status: res.status, body: parsed as never };
    },
    { method, url, body, branch },
  );
}

let phoneSeq = 0;
/** A synthetic 10-digit mobile number, different for every call of every run. */
export function syntheticPhone(): string {
  phoneSeq += 1;
  return `09${`${Date.now()}${phoneSeq}`.slice(-8)}`;
}

/** Soft-deletes a ticket the spec created; a ticket already gone is fine. */
export async function removeTicket(page: Page, id: string): Promise<void> {
  await call(page, "DELETE", `${TICKETS}/${id}`, { reason: "e2e cleanup" });
}

export interface StaffMember {
  id: string;
  name: string;
}

/** Branch 1 staff a ticket can be assigned or transferred to. */
export async function staffOf(page: Page, branch = BRANCH_ONE): Promise<StaffMember[]> {
  return (await call<{ items: StaffMember[] }>(page, "GET", `${TICKETS}/assignees?clinicBranchId=${branch}`)).body.items;
}

export interface TicketRow {
  id: string;
  phone: string;
  fullName: string;
  assigneeId: string | null;
}

/** Every branch-1 ticket matching a list query string, read by its own request. */
export async function ticketsWhere(page: Page, query: string): Promise<TicketRow[]> {
  const res = await call<{ items: TicketRow[] }>(page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&MaxResultCount=100&${query}`);
  return res.body.items;
}

/** A one-sheet .xlsx of the given rows (first row = headers), base64 for the page. */
export function ticketWorkbook(rows: string[][]): string {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Ticket");
  return XLSX.write(book, { type: "base64", bookType: "xlsx" });
}

/** The same workbook as bytes, for the dialog's file input. */
export function ticketWorkbookBuffer(rows: string[][]): Buffer {
  return Buffer.from(ticketWorkbook(rows), "base64");
}

/**
 * A real multipart upload to the Ticket File endpoints from inside the page,
 * in Vietnamese so header matching and row errors read as the clinic sees them.
 */
export async function uploadTicketFile<T>(
  page: Page,
  url: string,
  fileName: string,
  base64: string,
  fields: [string, string][],
  branch = BRANCH_ONE,
): Promise<Reply<T>> {
  return page.evaluate(
    async ({ url, fileName, base64, fields, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
      for (const [name, value] of fields) form.append(name, value);
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Accept-Language": "vi",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: form,
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { status: res.status, body: parsed as never };
    },
    { url, fileName, base64, fields, branch },
  );
}
