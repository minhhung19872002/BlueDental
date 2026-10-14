import { expect, type Page } from "@playwright/test";
import { BRANCH_ONE, call, type ApiAnswer } from "./catalogApi";

/**
 * Real-HTTP helpers for the Màn hình đợi specs (F-45, per-counter queues).
 * Every request goes from the logged-in page with its real session cookie;
 * nothing is intercepted.
 */

export const QUEUE = "/api/v1/app/queue";

export const WAITING = 1;
export const CALLED = 2;
export const SERVING = 3;
export const COMPLETED = 4;
export const SKIPPED = 5;
export const NORMAL = 0;
export const URGENT = 1;

export interface Ticket {
  id: string;
  displayNumber: string;
  ticketNumber: number;
  status: number;
  priority: number;
  patientId: string | null;
  counterId: string | null;
  counterName: string | null;
  dentistId: string | null;
  clinicBranchId: string;
}

export interface Counter {
  id: string;
  name: string;
  isActive: boolean;
  clinicBranchId: string;
  dentistId: string | null;
  dentistName: string | null;
  numberPrefix: string;
  startNumber: number;
  lastIssuedNumber: string | null;
}

export interface BoardTicket {
  id: string;
  displayNumber: string;
  priority: number;
}

export interface BoardCounter {
  id: string;
  name: string;
  isActive: boolean;
  numberPrefix: string;
  dentistId: string | null;
  dentistName: string | null;
  current: BoardTicket | null;
  upcoming: BoardTicket[];
  waitingCount: number;
  minutesPerPatient: number;
  longestWaitMinutes: number;
  newTicketWaitMinutes: number;
}

export interface CounterQueue {
  counter: BoardCounter;
  configuredMinutesPerPatient: number;
  actualMinutesPerPatient: number | null;
  nextNumber: string;
  waiting: { id: string; displayNumber: string; estimatedCallAt: string; waitedMinutes: number }[];
}

export interface Dentist {
  id: string;
  label: string;
}

export interface CounterInput {
  name: string;
  numberPrefix: string;
  dentistId: string | null;
  startNumber?: number;
}

export type ApiError = { error?: { code?: string } } | null;

export function errorCode(answer: ApiAnswer<unknown>): string | undefined {
  return (answer.body as ApiError)?.error?.code;
}

export async function listCounters(page: Page, branchId = BRANCH_ONE): Promise<Counter[]> {
  const res = await call<Counter[]>(page, "GET", `${QUEUE}/counters`, undefined, branchId);
  expect(res.status, "list counters").toBe(200);
  return res.body;
}

/**
 * Dentists who head no live counter of branch 1 yet — a dentist heads one
 * counter only, so every counter a spec creates needs its own.
 */
export async function freeDentists(page: Page, count: number): Promise<Dentist[]> {
  const staff = await call<{ items: { id: string; name: string | null; surname: string | null; userName: string }[] }>(
    page,
    "GET",
    "/api/v1/app/staff?Role=1&MaxResultCount=200",
  );
  expect(staff.status, "list dentists").toBe(200);
  const heading = new Set((await listCounters(page)).map((c) => c.dentistId).filter(Boolean));
  const free = staff.body.items
    .filter((row) => !heading.has(row.id))
    .map((row) => ({
      id: row.id,
      label: [row.surname, row.name].filter(Boolean).join(" ").trim() || row.userName,
    }));
  expect(free.length, `${count} dentists free of any counter`).toBeGreaterThanOrEqual(count);
  return free.slice(0, count);
}

/** Two-character prefixes no live counter of branch 1 uses. */
export async function freePrefixes(page: Page, count: number): Promise<string[]> {
  const used = new Set((await listCounters(page)).map((c) => c.numberPrefix));
  const free: string[] = [];
  for (const first of "QWXYZ") {
    for (const second of "123456789") {
      const prefix = `${first}${second}`;
      if (!used.has(prefix)) free.push(prefix);
    }
  }
  const start = Math.floor(Math.random() * Math.max(1, free.length - count));
  return free.slice(start, start + count);
}

export function saveCounter(page: Page, input: CounterInput, id?: string): Promise<ApiAnswer<Counter>> {
  const body = { sortOrder: 99, startNumber: 1, autoResetDaily: true, waitWarningMinutes: 30, minutesPerPatient: 12, ...input };
  return id
    ? call<Counter>(page, "PUT", `${QUEUE}/counters/${id}`, body)
    : call<Counter>(page, "POST", `${QUEUE}/counters`, body);
}

export async function createCounter(page: Page, input: CounterInput): Promise<Counter> {
  const res = await saveCounter(page, input);
  expect(res.status, `create counter ${input.name}: ${errorCode(res)}`).toBe(200);
  return res.body;
}

/** Today's numbers still at the counter: waiting, called or being seen. */
export async function liveTickets(page: Page, counterId: string): Promise<Ticket[]> {
  const res = await call<{ items: Ticket[] }>(
    page,
    "GET",
    `${QUEUE}/tickets?CounterId=${counterId}&MaxResultCount=1000`,
  );
  expect(res.status, "list counter tickets").toBe(200);
  return res.body.items.filter((t) => t.status === WAITING || t.status === CALLED || t.status === SERVING);
}

/** Empties the counter's queue the way the desk would: skip the waiting / called, complete the one being seen. */
export async function drainCounter(page: Page, counterId: string): Promise<void> {
  for (const ticket of await liveTickets(page, counterId)) {
    const action = ticket.status === SERVING ? "complete" : "skip";
    await call(page, "POST", `${QUEUE}/tickets/${ticket.id}/${action}`);
  }
}

/** Spec cleanup: a counter with anyone in its queue cannot be deleted (Queue:0015), so drain it first. */
export async function deleteCounters(page: Page, counters: (Counter | undefined)[]): Promise<void> {
  for (const counter of counters) {
    if (!counter) continue;
    await drainCounter(page, counter.id);
    await call(page, "DELETE", `${QUEUE}/counters/${counter.id}`);
  }
}

export function takeNumber(
  page: Page,
  counterId: string | null,
  priority = NORMAL,
  branchId = BRANCH_ONE,
): Promise<ApiAnswer<Ticket>> {
  return call<Ticket>(page, "POST", `${QUEUE}/tickets`, { counterId, priority, serviceType: "e2e" }, branchId);
}

export function callNext(page: Page, counterId: string | null, branchId = BRANCH_ONE): Promise<ApiAnswer<Ticket>> {
  return call<Ticket>(page, "POST", `${QUEUE}/tickets/call-next`, { counterId }, branchId);
}

export async function getTicket(page: Page, id: string): Promise<Ticket> {
  const res = await call<Ticket>(page, "GET", `${QUEUE}/tickets/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

export async function getBoard(page: Page, branchId = BRANCH_ONE): Promise<ApiAnswer<BoardCounter[]>> {
  return call<BoardCounter[]>(page, "GET", `${QUEUE}/counters/board`, undefined, branchId);
}
