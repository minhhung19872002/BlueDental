import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, TEST_USER, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/catalogApi";
import { BRANCH_TWO } from "./fixtures/marketingTicket";
import {
  CALLED,
  COMPLETED,
  NORMAL,
  QUEUE,
  SKIPPED,
  URGENT,
  WAITING,
  callNext,
  createCounter,
  deleteCounters,
  errorCode,
  freeDentists,
  freePrefixes,
  getBoard,
  getTicket,
  saveCounter,
  takeNumber,
  type BoardCounter,
  type Counter,
  type CounterQueue,
  type Dentist,
  type Ticket,
} from "./fixtures/queueApi";

/**
 * Feature: Màn hình đợi (F-45, BA redesign 2026-10-09) — the rules the queue
 * API keeps on its own: each counter has its own queue, number prefix and a
 * required fixed dentist; a dentist heads one counter; the dentist changes
 * only while the counter is empty; a paused counter hands out and calls no
 * number; "Đặt lại số thứ tự" restarts numbering without renumbering anyone
 * still waiting.
 *
 * Real login, real HTTP from the logged-in page, real PostgreSQL. Nothing is
 * intercepted and no token is injected.
 */

async function loginAs(browser: Browser, creds = TEST_USER): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, creds);
  return page;
}

test.describe("Queue API — per-counter queues", () => {
  test.describe.configure({ mode: "serial" });

  const run = runId();
  let page: Page;
  let dentists: Dentist[];
  let prefixes: string[];
  let counterX: Counter;
  let counterY: Counter;
  let normal1: Ticket;
  let normal2: Ticket;
  let urgent: Ticket;

  test.beforeAll(async ({ browser }) => {
    page = await loginAs(browser);
    await page.goto("/queue");
    dentists = await freeDentists(page, 3);
    prefixes = await freePrefixes(page, 2);
  });

  test.afterAll(async () => {
    await deleteCounters(page, [counterX, counterY]);
    await page.context().close();
  });

  test("a counter needs a dentist who is a dentist, and a valid prefix", async () => {
    const base = { name: `E2E-X ${run}`, numberPrefix: prefixes[0] };

    const noDentist = await saveCounter(page, { ...base, dentistId: null });
    expect(noDentist.status).toBe(403);
    expect(errorCode(noDentist)).toBe("BlueDental:Queue:0013");

    const notDentist = await saveCounter(page, { ...base, dentistId: crypto.randomUUID() });
    expect(errorCode(notDentist)).toBe("BlueDental:Queue:0012");

    const badPrefix = await saveCounter(page, { ...base, numberPrefix: "A-", dentistId: dentists[0].id });
    expect(errorCode(badPrefix)).toBe("BlueDental:Queue:0010");
  });

  test("counters are created with their own prefix and dentist; both stay unique", async () => {
    counterX = await createCounter(page, {
      name: `E2E-X ${run}`,
      numberPrefix: prefixes[0].toLowerCase(),
      dentistId: dentists[0].id,
      startNumber: 5,
    });
    expect(counterX.numberPrefix, "prefix is stored upper-case").toBe(prefixes[0]);
    expect(counterX.dentistId).toBe(dentists[0].id);
    expect(counterX.dentistName).toBeTruthy();

    counterY = await createCounter(page, {
      name: `E2E-Y ${run}`,
      numberPrefix: prefixes[1],
      dentistId: dentists[1].id,
    });

    const samePrefix = await saveCounter(page, {
      name: `E2E-Z ${run}`,
      numberPrefix: prefixes[0],
      dentistId: dentists[2].id,
    });
    expect(errorCode(samePrefix)).toBe("BlueDental:Queue:0007");

    const sameDentist = await saveCounter(page, {
      name: `E2E-Z ${run}`,
      numberPrefix: "Z0",
      dentistId: dentists[0].id,
    });
    expect(errorCode(sameDentist)).toBe("BlueDental:Queue:0009");

    // An edit cannot drop the dentist either.
    const dropped = await saveCounter(
      page,
      { name: counterY.name, numberPrefix: prefixes[1], dentistId: null },
      counterY.id,
    );
    expect(errorCode(dropped)).toBe("BlueDental:Queue:0013");
  });

  test("a number is taken at a chosen counter, from that counter's sequence", async () => {
    const noCounter = await takeNumber(page, null);
    expect(errorCode(noCounter)).toBe("BlueDental:Queue:0004");

    const first = await takeNumber(page, counterX.id);
    expect(first.status).toBe(200);
    normal1 = first.body;
    expect(normal1.displayNumber, "start number 5").toBe(`${prefixes[0]}005`);
    expect(normal1.counterId).toBe(counterX.id);
    expect(normal1.dentistId, "the counter's dentist").toBe(dentists[0].id);
    expect(normal1.patientId).toBeNull();
    expect(normal1.status).toBe(WAITING);

    normal2 = (await takeNumber(page, counterX.id)).body;
    urgent = (await takeNumber(page, counterX.id, URGENT)).body;
    expect(normal2.displayNumber).toBe(`${prefixes[0]}006`);
    expect(urgent.displayNumber).toBe(`${prefixes[0]}007`);

    const again = await getTicket(page, normal1.id);
    expect(again.displayNumber, "persisted").toBe(normal1.displayNumber);
  });

  test("the board keeps each counter's queue to itself, urgent first", async () => {
    const board = await getBoard(page);
    expect(board.status).toBe(200);
    const x = board.body.find((c) => c.id === counterX.id);
    const y = board.body.find((c) => c.id === counterY.id);
    expect(x?.upcoming.map((t) => t.id)).toEqual([urgent.id, normal1.id, normal2.id]);
    expect(x?.waitingCount).toBe(3);
    expect(y?.upcoming, "Y's queue is not X's").toEqual([]);
    expect(y?.longestWaitMinutes, "nobody waits at Y").toBe(0);
    expect(y?.newTicketWaitMinutes, "an idle, empty counter calls a new number at once").toBe(0);

    const empty = await callNext(page, counterY.id);
    expect(errorCode(empty), "Y has nobody to call").toBe("BlueDental:Queue:0001");
  });

  test("call-next takes urgent, then the order numbers were taken; the previous one completes", async () => {
    const first = await callNext(page, counterX.id);
    expect(first.status).toBe(200);
    expect(first.body.id).toBe(urgent.id);
    expect(first.body.status).toBe(CALLED);

    const second = await callNext(page, counterX.id);
    expect(second.body.id).toBe(normal1.id);
    expect((await getTicket(page, urgent.id)).status, "auto-completed").toBe(COMPLETED);
  });

  test("the dentist cannot change while someone waits or is being seen", async () => {
    const res = await saveCounter(
      page,
      { name: counterX.name, numberPrefix: prefixes[0], dentistId: dentists[2].id },
      counterX.id,
    );
    expect(errorCode(res)).toBe("BlueDental:Queue:0008");

    // Other settings still save while the queue runs.
    const renamed = await saveCounter(
      page,
      { name: `${counterX.name} r`, numberPrefix: prefixes[0], dentistId: dentists[0].id, startNumber: 5 },
      counterX.id,
    );
    expect(renamed.status).toBe(200);
    counterX = renamed.body;
  });

  test("the counter's waiting list estimates when each number is called", async () => {
    const res = await call<CounterQueue>(page, "GET", `${QUEUE}/counters/${counterX.id}/queue`);
    expect(res.status).toBe(200);
    expect(res.body.counter.current?.id).toBe(normal1.id);
    expect(res.body.waiting.map((row) => row.id)).toEqual([normal2.id]);
    expect(res.body.nextNumber).toBe(`${prefixes[0]}008`);
    expect(Date.parse(res.body.waiting[0].estimatedCallAt)).toBeGreaterThan(Date.now() - 60_000);

    // Chờ lâu nhất = the longest of those still waiting, from taking the number.
    const { counter, waiting } = res.body;
    expect(counter.longestWaitMinutes).toBe(Math.max(...waiting.map((row) => row.waitedMinutes)));

    // The urgent number's visit lasted seconds (call-next completed it): not a
    // real visit, so the pace stays the configured one.
    expect(res.body.actualMinutesPerPatient).toBeNull();
    expect(counter.minutesPerPatient).toBe(res.body.configuredMinutesPerPatient);

    // Số mới chờ: a new number waits for the visit under way (called seconds ago,
    // so nearly a whole pace left) plus one pace per number ahead of it — not
    // just the numbers ahead, which left out the patient being seen.
    expect(counter.waitingCount).toBe(1);
    expect(counter.newTicketWaitMinutes).toBe(counter.minutesPerPatient * (counter.waitingCount + 1));

    // …and it agrees with the list: one pace after the last number's "Dự kiến gọi".
    const lastCall = Date.parse(waiting[waiting.length - 1].estimatedCallAt);
    const newCall = Date.now() + counter.newTicketWaitMinutes * 60_000;
    expect(Math.abs(newCall - (lastCall + counter.minutesPerPatient * 60_000))).toBeLessThan(60_000);
  });

  test("a skipped number leaves the queue and is not called again", async () => {
    const skip = await call<Ticket>(page, "POST", `${QUEUE}/tickets/${normal1.id}/skip`);
    expect(skip.status).toBe(200);
    expect(skip.body.status).toBe(SKIPPED);

    const next = await callNext(page, counterX.id);
    expect(next.body.id).toBe(normal2.id);
    const none = await callNext(page, counterX.id);
    expect(errorCode(none)).toBe("BlueDental:Queue:0001");
  });

  test("Đặt lại số thứ tự restarts numbering; numbers still waiting keep theirs", async () => {
    const y1 = (await takeNumber(page, counterY.id)).body;
    const y2 = (await takeNumber(page, counterY.id, NORMAL)).body;
    expect([y1.displayNumber, y2.displayNumber]).toEqual([`${prefixes[1]}001`, `${prefixes[1]}002`]);
    await callNext(page, counterY.id);
    await call(page, "POST", `${QUEUE}/tickets/${y1.id}/skip`);

    const reset = await call<Counter>(page, "POST", `${QUEUE}/counters/${counterY.id}/reset-sequence`);
    expect(reset.status).toBe(200);

    // 001 left the queue (skipped) so it is free again; 002 still waits and is passed over.
    const y3 = (await takeNumber(page, counterY.id)).body;
    expect(y3.displayNumber).toBe(`${prefixes[1]}001`);
    const y4 = (await takeNumber(page, counterY.id)).body;
    expect(y4.displayNumber).toBe(`${prefixes[1]}003`);
    expect((await getTicket(page, y2.id)).displayNumber, "waiting number kept").toBe(`${prefixes[1]}002`);
  });

  test("a paused counter hands out no number and cannot call", async () => {
    const toggled = await call<Counter>(page, "POST", `${QUEUE}/counters/${counterY.id}/toggle`);
    expect(toggled.body.isActive).toBe(false);

    expect(errorCode(await takeNumber(page, counterY.id))).toBe("BlueDental:Queue:0006");
    expect(errorCode(await callNext(page, counterY.id))).toBe("BlueDental:Queue:0005");

    const board = await getBoard(page);
    expect(board.body.find((c) => c.id === counterY.id)?.isActive).toBe(false);
  });

  test("the public TV board serves the branch without a session and without PHI", async ({ request }) => {
    const res = await request.get(`${QUEUE}/display/board?branchId=${counterX.clinicBranchId}`);
    expect(res.status()).toBe(200);
    const board = (await res.json()) as BoardCounter[];
    const x = board.find((c) => c.id === counterX.id);
    expect(x?.current?.displayNumber).toBe(normal2.displayNumber);
    expect(x?.dentistName).toBeTruthy();
    expect(JSON.stringify(board)).not.toMatch(/"patient(Id|Name)"/i);
  });

  test("another branch neither sees these counters nor uses them", async ({ browser }) => {
    const other = await loginAs(browser, BRANCH2_USER);
    try {
      await other.goto("/queue");
      const board = await getBoard(other, BRANCH_TWO);
      expect(board.status).toBe(200);
      expect(board.body.some((c) => c.id === counterX.id)).toBe(false);

      expect((await callNext(other, counterX.id, BRANCH_TWO)).status).toBe(404);
      expect((await takeNumber(other, counterX.id, NORMAL, BRANCH_TWO)).status).toBe(404);
    } finally {
      await other.context().close();
    }
  });
});
