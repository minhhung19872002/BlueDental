import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  activateWarranty,
  call,
  clinicToday,
  createOrder,
  LABO_ORDERS,
  LaboStatus,
  laboCatalog,
  orderBody,
  passAll,
  PLANS,
  receive,
  sentOrder,
  STAGES,
  type LaboLine,
  type SpecService,
} from "./fixtures/laboApi";
import { createDentist, deleteDentist, openDentistSession, resetDentistLeaves } from "./fixtures/restrictedDentist";
import { clinicDay, freshLine, postDated, type StageDto } from "./fixtures/stageDateLock";
import {
  activateDental,
  addStage,
  closeStage,
  completeLine,
  doctorId,
  WarrantyKind,
} from "./fixtures/warrantyApi";

/**
 * Feature F-88 (BA 2026-11-02), docs/testing/features/labo-workflow.md:
 *
 * - a Labo warranty công đoạn never moves its service line, and Bảo hành dịch
 *   vụ waits until no Labo order of the line is unfinished (0062);
 * - on one service line only the công đoạn of the newest Ngày điều trị can be
 *   ticked Hoàn thành, reverted or have a Labo order raised (0063);
 * - an admin deletes a công đoạn, which gives its teeth back to the one before
 *   it — unless an order still stands on it (0064) or it was carried on (0065).
 *
 * Every call is a real HTTP request from inside the logged-in page. No route is
 * intercepted, and every write is read back with a separate request.
 */

const code = (n: number) => `BlueDental:Treatment:${String(n).padStart(4, "0")}`;
const LABO_UNFINISHED = code(62);
const DATE_LOCKED = code(63);
const DELETE_HAS_LABO = code(64);
const DELETE_HAS_SUCCESSOR = code(65);

const WARRANTY_SERVICE: SpecService = { name: "DV BẢO HÀNH E2E", warrantyDays: 365 };
/** TreatmentServiceStatus on the wire. */
const Line = { InProgress: 2, Done: 3 } as const;
/** WarrantyCellState on the wire. */
const NOT_ELIGIBLE = 1;
/** TreatmentStageStatus.Completed on the wire. */
const COMPLETED = 3;

interface OverviewRow {
  lineId: string;
  status: number;
  dental: number;
}

async function continueStage(
  page: Page,
  line: LaboLine,
  id: string,
  extra: { treatmentDate?: string; toothCodes?: number[] } = {},
): Promise<string> {
  const next = await call<StageDto>(page, `${STAGES}/${id}/continue`, {
    method: "POST",
    branchId: line.branchId,
    json: { staffId: await doctorId(page, line.branchId), note: `e2e tiếp tục ${runId()}`, ...extra },
  });
  expect(next.status, next.text).toBe(200);
  return next.body.id!;
}

async function stage(page: Page, line: LaboLine, id: string): Promise<StageDto> {
  const res = await call<StageDto>(page, `${STAGES}/${id}`, { branchId: line.branchId });
  expect(res.status, res.text).toBe(200);
  return res.body as StageDto;
}

async function row(page: Page, line: LaboLine): Promise<OverviewRow> {
  const res = await call<{ rows: OverviewRow[] }>(page, `${PLANS}/${line.planId}/warranty-overview`, {
    branchId: line.branchId,
  });
  expect(res.status, res.text).toBe(200);
  return res.body.rows!.find((one) => one.lineId === line.lineId)!;
}

function stageCall(page: Page, line: LaboLine, id: string, action: "complete" | "revert-status") {
  return call(page, `${STAGES}/${id}/${action}`, { method: "POST", branchId: line.branchId });
}

function deleteStage(page: Page, line: LaboLine, id: string) {
  return call(page, `${STAGES}/${id}`, { method: "DELETE", branchId: line.branchId });
}

function refusedWith(
  res: { status: number; text: string; body: { error?: { code?: string } } },
  errorCode: string,
) {
  expect(res.status, res.text).toBe(403);
  expect(res.body.error?.code).toBe(errorCode);
}

test.describe("Stage date lock + Labo warranty split (F-88)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a Labo warranty công đoạn leaves its line Hoàn thành, open or closed", async ({ page }) => {
    const id = runId();
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [11, 21] });
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(
      page,
      orderBody(catalog, line, id, { teeth: [11, 21], treatmentServiceId: line.lineId }),
    );
    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);

    const worked = await postDated(page, line, [11, 21], clinicDay(-2));
    await closeStage(page, line, worked);
    expect((await row(page, line)).status).toBe(Line.Done);

    const activated = await activateWarranty(
      page,
      order.id,
      [11, 21].map((toothNumber) => ({ toothNumber, startDate: today, months: 12 })),
    );
    expect(activated.status, activated.text).toBe(200);

    const warranty = await addStage(page, line, [11], {
      source: worked,
      kind: WarrantyKind.Labo,
      laboOrderId: order.id,
    });
    expect((await row(page, line)).status).toBe(Line.Done);

    // Dated after the clinic's own row, the warranty row neither locks it nor is locked.
    expect((await stage(page, line, worked)).isDateLocked).toBe(false);
    expect((await stage(page, line, warranty)).isDateLocked).toBe(false);

    await closeStage(page, line, warranty);
    expect((await row(page, line)).status).toBe(Line.Done);
  });

  test("a line finished by hand with only a Labo warranty công đoạn stays Hoàn thành", async ({ page }) => {
    const id = runId();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [11, 21] });
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(
      page,
      orderBody(catalog, line, id, { teeth: [11, 21], treatmentServiceId: line.lineId }),
    );
    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);
    expect((await completeLine(page, line)).status).toBe(200);
    const activated = await activateWarranty(page, order.id, [
      { toothNumber: 11, startDate: clinicToday(), months: 12 },
    ]);
    expect(activated.status, activated.text).toBe(200);

    const warranty = await addStage(page, line, [11], { kind: WarrantyKind.Labo, laboOrderId: order.id });
    expect((await row(page, line)).status).toBe(Line.Done);
    await closeStage(page, line, warranty);
    expect((await row(page, line)).status).toBe(Line.Done);
  });

  test("Bảo hành dịch vụ waits while a Labo order of the line is unfinished (0062)", async ({ page }) => {
    const id = runId();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [36] });
    // Worked the day before the order is written, so the order does not lock it.
    const worked = await postDated(page, line, [36], clinicDay(-1));
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(
      page,
      orderBody(catalog, line, id, { teeth: [36], quantity: 1, treatmentServiceId: line.lineId }),
    );
    await closeStage(page, line, worked);

    const before = await row(page, line);
    expect(before.status).toBe(Line.Done);
    expect(before.dental).toBe(NOT_ELIGIBLE);
    refusedWith(await activateDental(page, line, [{ toothNumber: 36, startDate: clinicToday() }]), LABO_UNFINISHED);

    // Cancelled, the order no longer holds the card back.
    const cancelled = await call(page, `${LABO_ORDERS}/${order.id}/cancel`, { method: "POST", branchId: line.branchId });
    expect(cancelled.status, cancelled.text).toBe(200);
    const activated = await activateDental(page, line, [{ toothNumber: 36, startDate: clinicToday() }]);
    expect(activated.status, activated.text).toBe(200);
  });

  test("only the newest Ngày điều trị of a line is ticked, reverted or raises Labo (0063)", async ({ page }) => {
    const id = runId();
    const line = await freshLine(page, { teeth: [36, 37, 38] });
    const older = await postDated(page, line, [36], clinicDay(-2));
    expect((await stage(page, line, older)).isDateLocked).toBe(false);

    const newer = await postDated(page, line, [37], clinicDay(-1));
    expect((await stage(page, line, older)).isDateLocked).toBe(true);
    expect((await stage(page, line, newer)).isDateLocked).toBe(false);

    refusedWith(await stageCall(page, line, older, "complete"), DATE_LOCKED);
    const catalog = await laboCatalog(page, line.branchId, id);
    refusedWith(
      await createOrder(
        page,
        orderBody(catalog, line, id, {
          teeth: [36],
          quantity: 1,
          treatmentServiceId: line.lineId,
          treatmentStageId: older,
        }),
      ),
      DATE_LOCKED,
    );

    // The way out: Tiếp tục công đoạn onto the newest day.
    const carried = await continueStage(page, line, older, { treatmentDate: clinicDay(-1) });
    expect((await stage(page, line, carried)).isDateLocked).toBe(false);
    expect((await stageCall(page, line, carried, "complete")).status).toBe(200);

    // A ticked row a later day overtakes cannot be un-ticked either.
    const later = await postDated(page, line, [38], clinicDay(0));
    expect((await stage(page, line, carried)).isDateLocked).toBe(true);
    refusedWith(await stageCall(page, line, carried, "revert-status"), DATE_LOCKED);
    expect((await stage(page, line, carried)).status).toBe(COMPLETED);
    expect((await stage(page, line, later)).isDateLocked).toBe(false);
  });

  test("a back-dated sole row and rows sharing the newest day stay open", async ({ page }) => {
    const line = await freshLine(page, { teeth: [36, 37] });
    const sole = await postDated(page, line, [36], clinicDay(-5));
    expect((await stage(page, line, sole)).isDateLocked).toBe(false);

    const sameDay = await postDated(page, line, [37], clinicDay(-5));
    expect((await stage(page, line, sole)).isDateLocked).toBe(false);
    expect((await stage(page, line, sameDay)).isDateLocked).toBe(false);
    expect((await stageCall(page, line, sole, "complete")).status).toBe(200);
  });

  test("an admin deletes a công đoạn: its teeth go back and the line is read again (0064/0065)", async ({ page }) => {
    const id = runId();
    const line = await freshLine(page, { teeth: [36] });
    const first = await addStage(page, line, [36]);
    const next = await continueStage(page, line, first);
    expect((await stage(page, line, first)).isSuperseded).toBe(true);

    // Carried on: the chain would break.
    refusedWith(await deleteStage(page, line, first), DELETE_HAS_SUCCESSOR);

    // A Nháp order still on it.
    const catalog = await laboCatalog(page, line.branchId, id);
    const draft = await createOrder(
      page,
      orderBody(catalog, line, id, { teeth: [36], quantity: 1, treatmentServiceId: line.lineId, treatmentStageId: next }),
    );
    expect(draft.status, draft.text).toBe(200);
    expect(draft.body.status).toBe(LaboStatus.Draft);
    refusedWith(await deleteStage(page, line, next), DELETE_HAS_LABO);

    const cancelled = await call(page, `${LABO_ORDERS}/${draft.body.id}/cancel`, {
      method: "POST",
      branchId: line.branchId,
    });
    expect(cancelled.status, cancelled.text).toBe(200);
    await closeStage(page, line, next);
    expect((await row(page, line)).status).toBe(Line.Done);

    const deleted = await deleteStage(page, line, next);
    expect([200, 204], deleted.text).toContain(deleted.status);

    const gone = await call(page, `${STAGES}/${next}`, { branchId: line.branchId });
    expect(gone.status).toBe(404);
    const back = await stage(page, line, first);
    expect(back.isSuperseded).toBe(false);
    expect(back.continuedToothCodes).toEqual([]);
    expect((await row(page, line)).status).toBe(Line.InProgress);
  });

  test("Xóa công đoạn needs Công đoạn › Xóa", async ({ page, browser }) => {
    const id = runId();
    const fullName = `BAC SI XOA CD ${id}`;
    const userName = `bsxoacd${id}`;
    const password = "Bacsi@123456";
    const line = await freshLine(page, { teeth: [36] });
    const made = await addStage(page, line, [36]);

    await resetDentistLeaves(page, ["treatmentStage.delete"]);
    await createDentist(page, fullName, userName, password);
    const dentist = await openDentistSession(browser, userName, password);
    try {
      const refused = await deleteStage(dentist.page, line, made);
      expect(refused.status, refused.text).toBe(403);
      expect((await stage(page, line, made)).id).toBe(made);
    } finally {
      await dentist.context.close();
      await deleteDentist(page, fullName);
    }
  });
});
