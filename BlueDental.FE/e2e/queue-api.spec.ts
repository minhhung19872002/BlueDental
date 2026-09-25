import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, TEST_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: Màn hình đợi (F-43) — the rules the queue API keeps on its own,
 * per BA item 22: a number is taken without a patient or a counter, every
 * counter calls from one shared pool (priority first, then the lowest
 * number), calling auto-completes the counter's previous number, a paused
 * counter cannot call, and skipped numbers wait for a manual recall.
 *
 * Every call is a real HTTP request issued from inside the logged-in page,
 * with the cookie the real login left and the antiforgery token the server
 * set. Nothing is intercepted, no token is injected, and the database is the
 * real one (see e2e/labo-api.spec.ts for the same pattern).
 */

const BASE = "/api/v1/app/queue";

interface Ticket {
  id: string;
  displayNumber: string;
  status: number;
  priority: number;
  patientId: string | null;
  counterId: string | null;
  clinicBranchId: string;
}

interface Counter {
  id: string;
  name: string;
  isActive: boolean;
  clinicBranchId: string;
}

interface BoardCounter {
  id: string;
  name: string;
  isActive: boolean;
  current: { id: string; displayNumber: string } | null;
  next: { id: string; displayNumber: string } | null;
}

interface ApiResult<T = Record<string, unknown>> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

interface CallOptions {
  method?: "GET" | "PUT" | "POST" | "DELETE";
  json?: unknown;
}

const WAITING = 1;
const CALLED = 2;
const COMPLETED = 4;
const SKIPPED = 5;
const NORMAL = 0;
const URGENT = 1;

/** One request from the logged-in page: cookie session + antiforgery header. */
async function call<T = Record<string, unknown>>(
  page: Page,
  url: string,
  options: CallOptions = {},
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ url, options }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      let body: string | undefined;
      if (options.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.json);
      }
      const res = await fetch(url, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body,
      });
      const text = await res.text();
      const parse = (): unknown => {
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          return {};
        }
      };
      return { status: res.status, body: parse() as ApiResult<T>["body"] };
    },
    { url, options },
  );
}

async function createCounter(page: Page, name: string): Promise<Counter> {
  const res = await call<Counter>(page, `${BASE}/counters`, {
    method: "POST",
    json: { name, sortOrder: 99 },
  });
  expect(res.status, `create counter ${name}`).toBe(200);
  return res.body;
}

async function takeNumber(page: Page, priority: number, note: string): Promise<Ticket> {
  const res = await call<Ticket>(page, `${BASE}/tickets`, {
    method: "POST",
    json: { priority, note, serviceType: "e2e" },
  });
  expect(res.status, `take number (${note})`).toBe(200);
  return res.body;
}

async function callNext(page: Page, counterId: string | null): Promise<ApiResult<Ticket>> {
  return call<Ticket>(page, `${BASE}/tickets/call-next`, { method: "POST", json: { counterId } });
}

async function getTicket(page: Page, id: string): Promise<Ticket> {
  const res = await call<Ticket>(page, `${BASE}/tickets/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

async function getBoard(page: Page): Promise<BoardCounter[]> {
  const res = await call<BoardCounter[]>(page, `${BASE}/counters/board`);
  expect(res.status).toBe(200);
  return res.body;
}

/**
 * Empties today's shared pool through `counterId` so the order this spec
 * asserts is not disturbed by numbers an earlier run (or a colleague) left
 * waiting. Numbers pinned to other counters are not in this counter's pool
 * and cannot be picked by it, so they do not matter here.
 */
async function drainPool(page: Page, counterId: string): Promise<void> {
  for (let i = 0; i < 300; i += 1) {
    const res = await callNext(page, counterId);
    if (res.status === 200) continue;
    expect(res.body.error?.code).toBe("BlueDental:Queue:0001");
    return;
  }
  throw new Error("queue pool did not drain in 300 calls");
}

async function loginAs(
  browser: Browser,
  creds: { userName: string; password: string } = TEST_USER,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, creds);
  return page;
}

test.describe("Queue API — shared pool, priority and counter rules", () => {
  test.describe.configure({ mode: "serial" });

  const run = runId();
  let page: Page;
  let counterA: Counter;
  let counterB: Counter;
  let normal1: Ticket;
  let normal2: Ticket;
  let urgent: Ticket;

  test.beforeAll(async ({ browser }) => {
    page = await loginAs(browser);
    await page.goto("/queue");
    counterA = await createCounter(page, `E2E-A ${run}`);
    counterB = await createCounter(page, `E2E-B ${run}`);
    await drainPool(page, counterA.id);
  });

  test.afterAll(async () => {
    for (const counter of [counterA, counterB]) {
      if (!counter) continue;
      await call(page, `${BASE}/counters/${counter.id}`, { method: "DELETE" });
    }
    await page.context().close();
  });

  test("a number is taken without a patient and without a counter, and persists", async () => {
    normal1 = await takeNumber(page, NORMAL, `n1 ${run}`);
    expect(normal1.patientId).toBeNull();
    expect(normal1.counterId).toBeNull();
    expect(normal1.status).toBe(WAITING);
    expect(normal1.displayNumber).toMatch(/^A-\d{3}$/);

    const again = await getTicket(page, normal1.id);
    expect(again.displayNumber).toBe(normal1.displayNumber);
    expect(again.patientId).toBeNull();
  });

  test("every active counter is offered the same next number, priority first", async () => {
    normal2 = await takeNumber(page, NORMAL, `n2 ${run}`);
    urgent = await takeNumber(page, URGENT, `urgent ${run}`);
    expect(urgent.displayNumber > normal2.displayNumber).toBeTruthy();

    const board = await getBoard(page);
    const a = board.find((c) => c.id === counterA.id);
    const b = board.find((c) => c.id === counterB.id);
    expect(a?.next?.id, "counter A next = urgent").toBe(urgent.id);
    expect(b?.next?.id, "counter B next = urgent").toBe(urgent.id);
    expect(a?.current).toBeNull();
  });

  test("call-next takes the urgent number first, then the lowest number", async () => {
    const first = await callNext(page, counterA.id);
    expect(first.status).toBe(200);
    expect(first.body.id).toBe(urgent.id);
    expect(first.body.status).toBe(CALLED);
    expect(first.body.counterId).toBe(counterA.id);

    const board = await getBoard(page);
    const a = board.find((c) => c.id === counterA.id);
    const b = board.find((c) => c.id === counterB.id);
    expect(a?.current?.id).toBe(urgent.id);
    expect(a?.next?.id).toBe(normal1.id);
    expect(b?.next?.id).toBe(normal1.id);

    const second = await callNext(page, counterB.id);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(normal1.id);
    expect(second.body.counterId).toBe(counterB.id);
  });

  test("calling the next number auto-completes the counter's previous number", async () => {
    const third = await callNext(page, counterA.id);
    expect(third.status).toBe(200);
    expect(third.body.id).toBe(normal2.id);

    expect((await getTicket(page, urgent.id)).status, "urgent auto-completed at A").toBe(COMPLETED);
    expect((await getTicket(page, normal1.id)).status, "B's number untouched").toBe(CALLED);

    const board = await getBoard(page);
    expect(board.find((c) => c.id === counterA.id)?.current?.id).toBe(normal2.id);
    expect(board.find((c) => c.id === counterA.id)?.next).toBeNull();
  });

  test("call-next without a counter is refused", async () => {
    const res = await callNext(page, null);
    expect(res.status).not.toBe(200);
    expect(res.body.error?.code).toBe("BlueDental:Queue:0004");
  });

  test("a skipped number is not taken by call-next; it waits for a manual recall", async () => {
    const skipped = await takeNumber(page, NORMAL, `skip ${run}`);
    const called = await callNext(page, counterA.id);
    expect(called.body.id).toBe(skipped.id);
    const skip = await call<Ticket>(page, `${BASE}/tickets/${skipped.id}/skip`, { method: "POST" });
    expect(skip.status).toBe(200);
    expect(skip.body.status).toBe(SKIPPED);

    const later = await takeNumber(page, NORMAL, `later ${run}`);
    const next = await callNext(page, counterA.id);
    expect(next.body.id, "call-next passes over the skipped number").toBe(later.id);

    const recalled = await call<Ticket>(page, `${BASE}/tickets/${skipped.id}/recall`, {
      method: "POST",
      json: { counterId: counterB.id },
    });
    expect(recalled.status).toBe(200);
    expect(recalled.body.status).toBe(CALLED);
    expect(recalled.body.counterId).toBe(counterB.id);
  });

  test("a paused counter shows no next number and cannot call", async () => {
    const toggled = await call<Counter>(page, `${BASE}/counters/${counterB.id}/toggle`, {
      method: "POST",
    });
    expect(toggled.status).toBe(200);
    expect(toggled.body.isActive).toBe(false);

    await takeNumber(page, NORMAL, `paused ${run}`);
    const board = await getBoard(page);
    const b = board.find((c) => c.id === counterB.id);
    expect(b?.isActive).toBe(false);
    expect(b?.next).toBeNull();
    expect(board.find((c) => c.id === counterA.id)?.next).not.toBeNull();

    const res = await callNext(page, counterB.id);
    expect(res.status).not.toBe(200);
    expect(res.body.error?.code).toBe("BlueDental:Queue:0005");
  });

  test("the public TV board serves the branch without a session", async ({ request }) => {
    const res = await request.get(`${BASE}/display/board?branchId=${counterA.clinicBranchId}`);
    expect(res.status()).toBe(200);
    const board = (await res.json()) as BoardCounter[];
    const a = board.find((c) => c.id === counterA.id);
    expect(a?.current?.displayNumber).toBeTruthy();
  });

  test("another branch neither sees these counters nor can call through them", async ({ browser }) => {
    const other = await loginAs(browser, BRANCH2_USER);
    try {
      await other.goto("/queue");
      const board = await call<BoardCounter[]>(other, `${BASE}/counters/board`);
      expect(board.status).toBe(200);
      expect(board.body.some((c) => c.id === counterA.id)).toBe(false);

      const res = await callNext(other, counterA.id);
      expect(res.status).toBe(404);
    } finally {
      await other.context().close();
    }
  });
});
