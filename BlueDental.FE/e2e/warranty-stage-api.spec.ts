import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  activateWarranty,
  call,
  clinicToday,
  freshSlip,
  laboCatalog,
  orderBody,
  passAll,
  PLANS,
  receive,
  sentOrder,
  serviceLine,
  STAGES,
  type LaboLine,
  type LineOptions,
  type SpecService,
} from "./fixtures/laboApi";
import {
  activateDental,
  addStage,
  completeLine,
  doctorId,
  postStage,
  WarrantyKind,
  type StageView,
} from "./fixtures/warrantyApi";

/**
 * Feature F-86, phase F: the warranty công đoạn names the card it is worked
 * under (P3110 REQ-F3..F5) and a line finished by hand takes one without a
 * source công đoạn (REQ-B8), docs/wip/p3110-labo-warranty-plan.md.
 *
 * Every call is a real HTTP request from inside the logged-in page — cookie
 * from the real login, the server's antiforgery token. No route is
 * intercepted, and every write is read back with a separate request.
 */

const code = (n: number) => `BlueDental:Treatment:${String(n).padStart(4, "0")}`;
const KIND_REQUIRED = code(58);
const CARD_NOT_VALID = code(59);
const LABO_ORDER_INVALID = code(60);
const TOOTH_NOT_COVERED = code(61);

const WARRANTY_SERVICE: SpecService = { name: "DV BẢO HÀNH E2E", warrantyDays: 365 };
const LABO_ACTIVATED = 3;
const DENTAL_ACTIVATED = 4;
const REQUEST_OPENED = 5;

interface WarrantyEvent {
  kind: number;
  lineId: string;
  teeth: number[];
  cardCodes: string[];
  laboOrderCode: string | null;
}

interface Overview {
  rows: { lineId: string; lineCode: string }[];
  history: WarrantyEvent[];
}

async function freshLine(page: Page, options: Omit<LineOptions, "planId">): Promise<LaboLine> {
  return serviceLine(page, { ...options, planId: await freshSlip(page, runId()) });
}

async function overview(page: Page, line: LaboLine): Promise<Overview> {
  const res = await call<Overview>(page, `${PLANS}/${line.planId}/warranty-overview`, {
    branchId: line.branchId,
  });
  expect(res.status, res.text).toBe(200);
  return res.body as Overview;
}

async function stage(page: Page, line: LaboLine, id: string): Promise<StageView> {
  const res = await call<StageView>(page, `${STAGES}/${id}`, { branchId: line.branchId });
  expect(res.status, res.text).toBe(200);
  return res.body as StageView;
}

function refusedWith(
  res: { status: number; text: string; body: { error?: { code?: string } } },
  errorCode: string,
) {
  expect(res.status, res.text).toBe(403);
  expect(res.body.error?.code).toBe(errorCode);
}

/** D4 (R-1090): BH-{mã dòng dịch vụ}-{ddMMyyyy}-{xx}, xx from 01 per line and start day. */
function cardCode(lineCode: string, start: string, number: number): string {
  const [y, m, d] = start.split("-");
  return `BH-${lineCode}-${d}${m}${y}-${String(number).padStart(2, "0")}`;
}

test.describe("Warranty công đoạn under a picked card (P3110 phase F)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a line finished by hand takes Nha khoa on the teeth its cards cover, without a source (REQ-B8/F3)", async ({
    page,
  }) => {
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [36, 37, 38] });
    expect((await completeLine(page, line)).status).toBe(200);

    // No card picked, then Nha khoa before any card is activated.
    refusedWith(await postStage(page, line, [36], { kind: null }), KIND_REQUIRED);
    refusedWith(await postStage(page, line, [36], { kind: WarrantyKind.Dental }), CARD_NOT_VALID);

    expect(
      (
        await activateDental(
          page,
          line,
          [36, 37].map((toothNumber) => ({ toothNumber, startDate: today })),
        )
      ).status,
    ).toBe(200);

    // 38 holds no card; Nha khoa names no Labo order.
    refusedWith(
      await postStage(page, line, [36, 38], { kind: WarrantyKind.Dental }),
      TOOTH_NOT_COVERED,
    );
    refusedWith(
      await postStage(page, line, [36], {
        kind: WarrantyKind.Dental,
        laboOrderId: crypto.randomUUID(),
      }),
      LABO_ORDER_INVALID,
    );

    const id = await addStage(page, line, [36], { source: null, kind: WarrantyKind.Dental });
    expect(await stage(page, line, id)).toMatchObject({
      isGuarantee: true,
      warrantyRootStageId: null,
      warrantyKind: WarrantyKind.Dental,
      warrantyLaboOrderId: null,
    });

    // Lịch sử names the card of the tooth worked on, not 37's.
    const after = await overview(page, line);
    const lineCode = after.rows.find((row) => row.lineId === line.lineId)!.lineCode;
    const opened = after.history.filter(
      (e) => e.lineId === line.lineId && e.kind === REQUEST_OPENED,
    );
    expect(opened.map((e) => [e.teeth, e.cardCodes, e.laboOrderCode])).toEqual([
      [[36], [cardCode(lineCode, today, 1)], null],
    ]);
  });

  test("Labo works under one order's activated teeth and Tiếp tục bảo hành keeps the pick (REQ-F4/F5)", async ({
    page,
  }) => {
    const id = runId();
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [11, 21, 22] });
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(
      page,
      orderBody(catalog, line, id, { teeth: [11, 21], treatmentServiceId: line.lineId }),
    );
    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);
    expect((await completeLine(page, line)).status).toBe(200);

    // QC passed, warranty not yet activated: no Labo card to work under.
    refusedWith(
      await postStage(page, line, [11], { kind: WarrantyKind.Labo, laboOrderId: order.id }),
      LABO_ORDER_INVALID,
    );

    // Only 11 is activated; 22 gets a dental card the Labo pick must not name.
    const labo = await activateWarranty(page, order.id, [
      { toothNumber: 11, startDate: today, months: 12 },
    ]);
    expect(labo.status, labo.text).toBe(200);
    expect((await activateDental(page, line, [{ toothNumber: 22, startDate: today }])).status).toBe(
      200,
    );

    refusedWith(await postStage(page, line, [11], { kind: WarrantyKind.Labo }), LABO_ORDER_INVALID);
    refusedWith(
      await postStage(page, line, [11], {
        kind: WarrantyKind.Labo,
        laboOrderId: crypto.randomUUID(),
      }),
      LABO_ORDER_INVALID,
    );
    refusedWith(
      await postStage(page, line, [11, 21], { kind: WarrantyKind.Labo, laboOrderId: order.id }),
      TOOTH_NOT_COVERED,
    );

    const made = await addStage(page, line, [11], {
      kind: WarrantyKind.Labo,
      laboOrderId: order.id,
    });
    expect(await stage(page, line, made)).toMatchObject({
      isGuarantee: true,
      warrantyKind: WarrantyKind.Labo,
      warrantyLaboOrderId: order.id,
    });

    const continued = await call<StageView>(page, `${STAGES}/${made}/continue`, {
      method: "POST",
      branchId: line.branchId,
      json: { staffId: await doctorId(page, line.branchId), note: `e2e tiếp tục bảo hành ${id}` },
    });
    expect(continued.status, continued.text).toBe(200);
    expect(await stage(page, line, continued.body.id!)).toMatchObject({
      isGuarantee: true,
      warrantyKind: WarrantyKind.Labo,
      warrantyLaboOrderId: order.id,
    });

    const history = (await overview(page, line)).history;
    const opened = history.filter((e) => e.lineId === line.lineId && e.kind === REQUEST_OPENED);
    const laboCard = history.find(
      (e) => e.lineId === line.lineId && e.laboOrderCode === order.orderCode && e.kind === 3,
    )!;
    expect(opened.map((e) => [e.teeth, e.cardCodes, e.laboOrderCode])).toEqual([
      [[11], laboCard.cardCodes, order.orderCode],
    ]);
    // R-1090: the Labo card and the Dịch vụ card after it share the line's count for the day.
    const lineCode = (await overview(page, line)).rows.find((row) => row.lineId === line.lineId)!.lineCode;
    const dentalCard = history.find((e) => e.lineId === line.lineId && e.kind === DENTAL_ACTIVATED)!;
    expect([laboCard.cardCodes, dentalCard.cardCodes]).toEqual([
      [cardCode(lineCode, today, 1)],
      [cardCode(lineCode, today, 2)],
    ]);
  });

  test("activations sent at once on one line and day take distinct, consecutive card numbers (R-1090)", async ({
    page,
  }) => {
    const id = runId();
    const today = clinicToday();
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [11, 21, 36, 37, 46, 47] });
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(
      page,
      orderBody(catalog, line, id, { teeth: [11, 21], treatmentServiceId: line.lineId }),
    );
    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);
    expect((await completeLine(page, line)).status).toBe(200);

    // One Labo batch and two Dịch vụ batches in flight together, all starting today.
    const results = await Promise.all([
      activateWarranty(
        page,
        order.id,
        [11, 21].map((toothNumber) => ({ toothNumber, startDate: today, months: 12 })),
      ),
      activateDental(page, line, [{ toothNumber: 36, startDate: today }]),
      activateDental(
        page,
        line,
        [37, 46].map((toothNumber) => ({ toothNumber, startDate: today })),
      ),
    ]);
    for (const res of results) expect(res.status, res.text).toBe(200);
    // A later start day counts again from 01.
    expect((await activateDental(page, line, [{ toothNumber: 47, startDate: tomorrow }])).status).toBe(200);

    // Read back with a separate request.
    const after = await overview(page, line);
    const lineCode = after.rows.find((row) => row.lineId === line.lineId)!.lineCode;
    const batches = after.history
      .filter((e) => e.lineId === line.lineId && (e.kind === LABO_ACTIVATED || e.kind === DENTAL_ACTIVATED))
      .map((e) => [...e.cardCodes].sort());
    const numbers = (codes: string[]) => codes.map((one) => Number(one.slice(one.lastIndexOf("-") + 1)));
    const todayStem = cardCode(lineCode, today, 1).slice(0, -2);
    const todays = batches.filter((codes) => codes[0].startsWith(todayStem));
    expect(todays.flat().sort()).toEqual([1, 2, 3, 4, 5].map((n) => cardCode(lineCode, today, n)));
    for (const codes of todays) {
      const [first, ...rest] = numbers(codes);
      expect(rest).toEqual(rest.map((_, i) => first + i + 1));
    }
    expect(batches.filter((codes) => !todays.includes(codes))).toEqual([[cardCode(lineCode, tomorrow, 1)]]);
  });
});
