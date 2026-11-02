import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import {
  activateWarranty,
  activateWarrantyWithPhotos,
  call,
  CardSide,
  check,
  clinicToday,
  Conclusion,
  createOrder,
  daysFromNow,
  LABO_ORDERS,
  laboCatalog,
  laboLine,
  LaboStatus,
  orderBody,
  passAll,
  PLANS,
  receive,
  sentOrder,
  STAGES,
  ToothResult,
  type LaboCatalog,
  type LaboLine,
  type LaboOrderView,
  type Paged,
} from "./fixtures/laboApi";
import { findLaboPatient } from "./fixtures/laboSeed";

/**
 * Feature F-85: the Labo workflow of P2910_03 — Nháp → Đã gửi Labo → Chờ kiểm
 * tra → Trả hàng / Hoàn thành → Bảo hành — and the rules the API keeps on its
 * own, whatever the dialog does (docs/wip/labo-workflow-p2910-03-plan.md).
 *
 * Every call is a real HTTP request issued from inside the logged-in page,
 * with the cookie the real login left and the antiforgery token the server
 * set. No route is intercepted, no token is injected, and every write is read
 * back with a separate request.
 */

const code = (n: number) => `BlueDental:Labo:${String(n).padStart(4, "0")}`;
const INVALID_TRANSITION = code(2);

interface StageRow {
  id: string;
  labo: { orderId: string; orderCode: string; status: number; isWarrantyExpired: boolean } | null;
  completeLockedByLabo: boolean;
  completeLockedByLaboOrder: { orderId: string; qualityPassedOn: string | null } | null;
  lineLaboOrderCount: number;
  isDateLocked: boolean;
}

interface SlipRow {
  services: {
    id: string;
    code: string;
    status: number;
    labOrders: { id: string; status: number; isUnfinished: boolean; dueAt: string | null }[];
  }[];
}

async function read(page: Page, id: string): Promise<LaboOrderView> {
  const res = await call<LaboOrderView>(page, `${LABO_ORDERS}/${id}`);
  expect(res.status, res.text).toBe(200);
  return res.body as LaboOrderView;
}

async function listed(page: Page, branchId: string, query: string): Promise<string[]> {
  const res = await call<Paged<{ id: string }>>(page, `${LABO_ORDERS}?MaxResultCount=1000&${query}`, { branchId });
  expect(res.status, res.text).toBe(200);
  return (res.body.items ?? []).map((one) => one.id);
}

async function addStage(
  page: Page,
  line: LaboLine,
  staffId: string,
  note: string,
  treatmentDate = clinicToday(),
): Promise<string> {
  const made = await call<{ id: string }>(page, STAGES, {
    method: "POST",
    branchId: line.branchId,
    json: {
      patientId: line.patientId,
      clinicBranchId: line.branchId,
      treatmentId: line.planId,
      treatmentServiceId: line.lineId,
      serviceId: line.serviceId,
      name: line.serviceName,
      note,
      staffId,
      treatmentDate,
      teeth: [],
    },
  });
  expect(made.status, made.text).toBe(200);
  return made.body.id!;
}

async function stagesOf(page: Page, line: LaboLine): Promise<Map<string, StageRow>> {
  const res = await call<Paged<StageRow>>(page, `${STAGES}?treatmentServiceId=${line.lineId}&maxResultCount=50`, {
    branchId: line.branchId,
  });
  expect(res.status, res.text).toBe(200);
  return new Map((res.body.items ?? []).map((row) => [row.id, row]));
}

async function slipLine(page: Page, line: LaboLine) {
  const res = await call<SlipRow>(page, `${PLANS}/${line.planId}`, { branchId: line.branchId });
  expect(res.status, res.text).toBe(200);
  return res.body.services?.find((one) => one.id === line.lineId);
}

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("Labo workflow API (P2910_03)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("an order walks the BA's state machine and refuses every wrong step", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const body = orderBody(catalog, line, id, { treatmentServiceId: line.lineId });

    // Lưu nháp: the lab's name is copied from the supplier picked.
    const draft = await createOrder(page, body);
    expect(draft.status, draft.text).toBe(200);
    expect(draft.body.status).toBe(LaboStatus.Draft);
    expect(draft.body.labProviderName).toBe(catalog.supplierName);
    expect(draft.body.teeth?.map((t) => t.toothNumber)).toEqual([11, 21]);
    const orderId = draft.body.id!;
    const self = `${LABO_ORDERS}/${orderId}`;

    // Gửi Labo needs Màu răng and Đường hoàn tất on every tooth (P3110 REQ-C1):
    // R21 without its finish line is refused, the order stays a Nháp.
    const gap = await call<LaboOrderView>(page, self, {
      method: "PUT",
      json: {
        ...body,
        submit: true,
        toothSpecs: [
          { toothNumber: 11, shade: "A1", finishLineId: catalog.finishLineId },
          { toothNumber: 21, shade: "A2" },
        ],
      },
    });
    expect(gap.status).toBe(403);
    expect(gap.body.error?.code).toBe(code(34));
    expect((await read(page, orderId)).status).toBe(LaboStatus.Draft);

    const sent = await call<LaboOrderView>(page, self, { method: "PUT", form: { ...body, submit: true }, pictures: 1 });
    expect(sent.status, sent.text).toBe(200);
    expect(sent.body.status).toBe(LaboStatus.Sent);
    expect(sent.body.images).toHaveLength(1);

    // The Đặt hàng tab is locked and only a Nháp has the bin.
    const edit = await call<LaboOrderView>(page, self, { method: "PUT", json: body });
    expect(edit.status).toBe(422);
    expect(edit.body.error?.code).toBe(INVALID_TRANSITION);
    const remove = await call(page, self, { method: "DELETE" });
    expect(remove.status).toBe(403);
    expect(remove.body.error?.code).toBe(code(30));

    // Nothing to check before Nhận hàng; then 1..Số lượng, not before Ngày gửi.
    const early = await check(page, orderId, {
      teeth: [11, 21].map((toothNumber) => ({ toothNumber, result: ToothResult.Passed })),
      conclusion: Conclusion.Pass,
    });
    expect(early.status).toBe(422);
    expect(early.body.error?.code).toBe(INVALID_TRANSITION);
    const tooMany = await receive(page, orderId, 3);
    expect(tooMany.status).toBe(403);
    expect(tooMany.body.error?.code).toBe(code(17));
    const beforeSent = await receive(page, orderId, 2, daysFromNow(-3));
    expect(beforeSent.status).toBe(403);
    expect(beforeSent.body.error?.code).toBe(code(18));

    const received = await receive(page, orderId, 2);
    expect(received.status, received.text).toBe(200);
    expect(received.body.status).toBe(LaboStatus.AwaitingCheck);
    expect(received.body.rounds?.map((r) => [r.roundNo, r.receivedQuantity])).toEqual([[1, 2]]);

    // Kiểm tra từng răng: every due tooth, a pass only when all pass, a return
    // only with a defect, its details and an Ảnh kiểm tra.
    const missing = await check(page, orderId, {
      teeth: [{ toothNumber: 11, result: ToothResult.Passed }],
      conclusion: Conclusion.Pass,
    });
    expect(missing.body.error?.code).toBe(code(19));
    const mixed = [
      { toothNumber: 11, result: ToothResult.Passed },
      { toothNumber: 21, result: ToothResult.Failed, note: `Hở bờ ${id}` },
    ];
    const notAll = await check(page, orderId, { teeth: mixed, conclusion: Conclusion.Pass });
    expect(notAll.status).toBe(403);
    expect(notAll.body.error?.code).toBe(code(22));
    const returnDetails = {
      description: `Sửa lại bờ răng 21 ${id}`,
      returnedAt: new Date().toISOString(),
      redeliveryDueAt: daysFromNow(5),
    };
    const noDefect = await check(
      page,
      orderId,
      { teeth: [11, 21].map((toothNumber) => ({ toothNumber, result: ToothResult.Passed })), conclusion: Conclusion.ReturnDefective, ...returnDetails },
      1,
    );
    expect(noDefect.body.error?.code).toBe(code(21));
    const noDetails = await check(page, orderId, { teeth: mixed, conclusion: Conclusion.ReturnDefective }, 1);
    expect(noDetails.body.error?.code).toBe(code(23));
    const noPicture = await check(page, orderId, { teeth: mixed, conclusion: Conclusion.ReturnDefective, ...returnDetails });
    expect(noPicture.body.error?.code).toBe(code(25));
    // A loose Ảnh kiểm tra does not stand in for R21's own Hình ảnh lỗi (REQ-D6).
    const loosePicture = await check(page, orderId, { teeth: mixed, conclusion: Conclusion.ReturnDefective, ...returnDetails }, 1);
    expect(loosePicture.body.error?.code).toBe(code(25));
    expect(loosePicture.body.error?.message).toContain("21");
    expect((await read(page, orderId)).status).toBe(LaboStatus.AwaitingCheck);

    // Trả hàng bị lỗi: 11 stays Đạt, 21 goes back, Hẹn Labo giao lại is the new due stamp.
    const returned = await check(page, orderId, { teeth: mixed, conclusion: Conclusion.ReturnDefective, ...returnDetails }, 0, [21]);
    expect(returned.status, returned.text).toBe(200);
    expect(returned.body.status).toBe(LaboStatus.Returned);
    expect(returned.body.returnCount).toBe(1);
    expect(new Date(returned.body.dueAt!).getTime()).toBe(new Date(returnDetails.redeliveryDueAt).getTime());
    expect(returned.body.teeth?.map((t) => [t.toothNumber, t.checkResult])).toEqual([
      [11, ToothResult.Passed],
      [21, ToothResult.Failed],
    ]);

    // A passed tooth waits on Bảo hành until the whole order is Hoàn thành.
    const tooSoon = await activateWarranty(page, orderId, [{ toothNumber: 11, startDate: clinicToday(), months: 12 }]);
    expect(tooSoon.status).toBe(403);
    expect(tooSoon.body.error?.code).toBe(code(26));

    // Nhận hàng · lần 2 re-checks only the tooth that failed.
    const again = await receive(page, orderId, 1);
    expect(again.status, again.text).toBe(200);
    expect(again.body.rounds).toHaveLength(2);
    const recheckPassed = await check(page, orderId, {
      teeth: [11, 21].map((toothNumber) => ({ toothNumber, result: ToothResult.Passed })),
      conclusion: Conclusion.Pass,
    });
    expect(recheckPassed.body.error?.code).toBe(code(20));
    await passAll(page, orderId, [21]);

    // Hoàn thành can no longer be cancelled.
    const cancel = await call(page, `${self}/cancel`, { method: "POST" });
    expect(cancel.status).toBe(422);
    expect(cancel.body.error?.code).toBe(INVALID_TRANSITION);

    // Kích hoạt bảo hành, tooth by tooth.
    const months0 = await activateWarranty(page, orderId, [{ toothNumber: 11, startDate: clinicToday(), months: 0 }]);
    expect(months0.body.error?.code).toBe(code(29));
    const beforePass = await activateWarranty(page, orderId, [
      { toothNumber: 11, startDate: daysFromNow(-2).slice(0, 10), months: 12 },
    ]);
    expect(beforePass.body.error?.code).toBe(code(28));
    const statsBefore = await call<{ completed: number; inWarranty: number }>(
      page,
      `${LABO_ORDERS}/stats?PatientId=${line.patientId}`,
      { branchId: line.branchId },
    );

    const first = await activateWarranty(page, orderId, [
      { toothNumber: 11, startDate: clinicToday(), months: 12, manufacturerSerial: `SN-${id}` },
    ]);
    expect(first.status, first.text).toBe(200);
    expect(first.body.status).toBe(LaboStatus.Warranty);
    // R-1090: BH-{mã dòng dịch vụ}-{ddMMyyyy}-{xx}, xx counted per line and start day.
    const [y, m, d] = clinicToday().split("-");
    const stem = `BH-${(await slipLine(page, line))!.code}-${d}${m}${y}`;
    const card11 = first.body.teeth?.find((t) => t.toothNumber === 11);
    expect(card11?.warrantyCardCode).toBe(`${stem}-01`);
    expect(card11?.warrantyMonths).toBe(12);
    expect(first.body.teeth?.find((t) => t.toothNumber === 21)?.warrantyCardCode).toBeNull();

    const twice = await activateWarranty(page, orderId, [{ toothNumber: 11, startDate: clinicToday(), months: 6 }]);
    expect(twice.body.error?.code).toBe(code(27));
    const second = await activateWarranty(page, orderId, [{ toothNumber: 21, startDate: clinicToday(), months: 24 }]);
    expect(second.status, second.text).toBe(200);
    expect(second.body.teeth?.find((t) => t.toothNumber === 21)?.warrantyCardCode).toBe(`${stem}-02`);

    // Read back with separate requests: the order, the filter cards, the counters.
    const reread = await read(page, orderId);
    expect(reread.status).toBe(LaboStatus.Warranty);
    expect(reread.isWarrantyExpired).toBe(false);
    expect(reread.rounds.map((r) => r.outcome)).toEqual([3, 1]);
    expect(reread.teeth.every((t) => t.warrantyCardCode !== null && t.checkResult === ToothResult.Passed)).toBe(true);
    expect(await listed(page, line.branchId, `PatientId=${line.patientId}&StatusFilter=5`)).toContain(orderId);
    expect(await listed(page, line.branchId, `PatientId=${line.patientId}&StatusFilter=4`)).not.toContain(orderId);
    const statsAfter = await call<{ completed: number; inWarranty: number }>(
      page,
      `${LABO_ORDERS}/stats?PatientId=${line.patientId}`,
      { branchId: line.branchId },
    );
    expect(statsAfter.body.completed).toBe(statsBefore.body.completed! - 1);
    expect(statsAfter.body.inWarranty).toBe(statsBefore.body.inWarranty! + 1);
  });

  test("Trả toàn bộ sends every tooth back and re-checks them all", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));
    expect((await receive(page, order.id, 2)).status).toBe(200);

    const returned = await check(
      page,
      order.id,
      {
        teeth: [
          { toothNumber: 11, result: ToothResult.Passed },
          { toothNumber: 21, result: ToothResult.Failed, note: `Sai khớp cắn ${id}` },
        ],
        conclusion: Conclusion.ReturnAll,
        description: `Làm lại cả hàm ${id}`,
        returnedAt: new Date().toISOString(),
        redeliveryDueAt: daysFromNow(4),
      },
      0,
      [21],
    );
    expect(returned.status, returned.text).toBe(200);
    expect(returned.body.teeth?.every((t) => t.checkResult !== ToothResult.Passed)).toBe(true);
    expect(returned.body.rounds?.[0].outcome).toBe(2);

    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);
    expect((await read(page, order.id)).status).toBe(LaboStatus.Completed);
  });

  test("each Lỗi tooth carries its own Mô tả gửi Labo, Hình ảnh lỗi and Đã trả count (P3110 REQ-D5/D6)", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));
    const dates = { returnedAt: new Date().toISOString(), redeliveryDueAt: daysFromNow(3) };
    const failBoth = (note21: string) => [
      { toothNumber: 11, result: ToothResult.Failed, note: `Lệch màu ${id}` },
      { toothNumber: 21, result: ToothResult.Failed, note: note21 },
    ];

    expect((await receive(page, order.id, 2)).status).toBe(200);
    // Mô tả gửi Labo · R21 * — a blank description names the tooth, the order-level Mô tả is gone.
    const blank = await check(page, order.id, { teeth: failBoth(" "), conclusion: Conclusion.ReturnAll, ...dates }, 0, [11]);
    expect(blank.status).toBe(403);
    expect(blank.body.error?.code).toBe(code(35));
    expect(blank.body.error?.message).toContain("21");
    // Hình ảnh lỗi belongs to a Lỗi tooth only.
    const passedTeeth = [
      { toothNumber: 11, result: ToothResult.Passed },
      { toothNumber: 21, result: ToothResult.Failed, note: `Hở bờ ${id}` },
    ];
    const wrongTooth = await check(page, order.id, { teeth: passedTeeth, conclusion: Conclusion.ReturnDefective, ...dates }, 0, [11]);
    expect(wrongTooth.status).toBe(403);
    expect(wrongTooth.body.error?.code).toBe(code(20));
    // Two Lỗi teeth, a Hình ảnh lỗi on R11 only: R21 is named (REQ-D6).
    const onePictured = await check(page, order.id, { teeth: failBoth(`Hở bờ ${id}`), conclusion: Conclusion.ReturnAll, ...dates }, 0, [11]);
    expect(onePictured.status).toBe(403);
    expect(onePictured.body.error?.code).toBe(code(25));
    expect(onePictured.body.error?.message).toContain("21");
    // Ảnh kiểm tra may come from the Lỗi rows alone.
    const first = await check(page, order.id, { teeth: failBoth(`Hở bờ ${id}`), conclusion: Conclusion.ReturnAll, ...dates }, 0, [11, 21]);
    expect(first.status, first.text).toBe(200);
    expect(first.body.rounds?.[0].returnDescription).toBe(`R11: Lệch màu ${id}; R21: Hở bờ ${id}`);
    expect(first.body.images?.filter((i) => i.roundNo === 1).map((i) => i.toothNumber).sort()).toEqual([11, 21]);

    // Lần 2: R11 passes, R21 goes back again — only R21's count climbs.
    expect((await receive(page, order.id, 2)).status).toBe(200);
    const second = await check(page, order.id, { teeth: passedTeeth, conclusion: Conclusion.ReturnDefective, ...dates }, 0, [21]);
    expect(second.status, second.text).toBe(200);

    const reread = await read(page, order.id);
    expect(reread.returnCount).toBe(2);
    expect(reread.teeth.map((t) => [t.toothNumber, t.returnCount])).toEqual([
      [11, 1],
      [21, 2],
    ]);
    expect(reread.rounds[1].toothResults.map((t) => [t.toothNumber, t.result, t.note])).toEqual([
      [11, ToothResult.Passed, null],
      [21, ToothResult.Failed, `Hở bờ ${id}`],
    ]);
  });

  test("Kích hoạt bảo hành carries each card's Mặt trước / Mặt sau photos (P3110 REQ-E1)", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));
    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);
    const card11 = [{ toothNumber: 11, startDate: clinicToday(), months: 12 }];

    // A face the card does not have never reaches the service: model binding refuses it.
    const noSuchFace = await activateWarrantyWithPhotos(page, order.id, card11, [{ tooth: 11, side: 3 }]);
    expect(noSuchFace.status, noSuchFace.text).toBe(400);
    expect(noSuchFace.text).toContain("cardPhotoSides");
    // A photo must name a tooth of this activation, and each face once.
    const refused = [
      [{ tooth: 21, side: CardSide.Front }],
      [
        { tooth: 11, side: CardSide.Front },
        { tooth: 11, side: CardSide.Front },
      ],
    ];
    for (const photos of refused) {
      const wrong = await activateWarrantyWithPhotos(page, order.id, card11, photos);
      expect(wrong.status, wrong.text).toBe(403);
      expect(wrong.body.error?.code).toBe(code(36));
    }
    // A tooth and a face with no photo beside them.
    const unpaired = await call(page, `${LABO_ORDERS}/${order.id}/warranty`, {
      method: "POST",
      form: {
        "cards[0].toothNumber": 11,
        "cards[0].startDate": clinicToday(),
        "cards[0].months": 12,
        cardPhotoTeeth: [11],
        cardPhotoSides: [CardSide.Front],
      },
    });
    expect(unpaired.status, unpaired.text).toBe(403);
    expect(unpaired.body.error?.code).toBe(code(36));
    // Nothing of a refused activation stays behind.
    const untouched = await read(page, order.id);
    expect(untouched.status).toBe(LaboStatus.Completed);
    expect(untouched.images.filter((i) => i.warrantyCardSide != null)).toEqual([]);

    // R11 with both faces; R21 later with none — the photos are optional.
    const both = [
      { tooth: 11, side: CardSide.Front },
      { tooth: 11, side: CardSide.Back },
    ];
    const first = await activateWarrantyWithPhotos(page, order.id, card11, both);
    expect(first.status, first.text).toBe(200);
    expect(first.body.status).toBe(LaboStatus.Warranty);
    const second = await activateWarranty(page, order.id, [{ toothNumber: 21, startDate: clinicToday(), months: 24 }]);
    expect(second.status, second.text).toBe(200);

    // Read back: the photos sit on R11 as card faces, apart from the order and check pictures.
    const reread = await read(page, order.id);
    const photos = reread.images.filter((i) => i.warrantyCardSide != null);
    expect(photos.map((i) => [i.toothNumber, i.roundNo, i.warrantyCardSide]).sort()).toEqual([
      [11, null, CardSide.Front],
      [11, null, CardSide.Back],
    ]);
    for (const photo of photos) expect((await call(page, photo.url)).status).toBe(200);
    expect(reread.teeth.every((t) => t.warrantyCardCode !== null)).toBe(true);
  });

  test("an unfinished order locks the công đoạn that raised it and the later ones until the day QC passes", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const stageA = await addStage(page, line, catalog.dentistId, `Labo A ${id}`);
    const stageB = await addStage(page, line, catalog.dentistId, `Labo B ${id}`);
    const order = await sentOrder(
      page,
      orderBody(catalog, line, id, { teeth: [11], quantity: 1, treatmentServiceId: line.lineId, treatmentStageId: stageA }),
    );

    let stages = await stagesOf(page, line);
    expect(stages.get(stageA)?.labo).toMatchObject({ orderId: order.id, orderCode: order.orderCode, status: LaboStatus.Sent });
    expect(stages.get(stageA)?.completeLockedByLabo).toBe(true);
    expect(stages.get(stageB)?.labo).toBeNull();
    expect(stages.get(stageB)?.completeLockedByLabo).toBe(true);
    // P3110 m38: the lock names its order; "BN có n phiếu" counts the line's orders.
    expect(stages.get(stageA)?.completeLockedByLaboOrder).toMatchObject({ orderId: order.id, qualityPassedOn: null });
    expect(stages.get(stageB)?.completeLockedByLaboOrder?.orderId).toBe(order.id);
    expect(stages.get(stageB)?.lineLaboOrderCount).toBe(1);

    const complete = (stageId: string) =>
      call(page, `${STAGES}/${stageId}/complete`, { method: "POST", branchId: line.branchId });
    const locked = await complete(stageB);
    expect(locked.status).toBe(403);
    expect(locked.body.error?.code).toBe(code(31));
    const raisedLocked = await complete(stageA);
    expect(raisedLocked.status).toBe(403);
    expect(raisedLocked.body.error?.code).toBe(code(31));

    // The plan row's Labo column reads the order's due stamp.
    const row = (await slipLine(page, line))?.labOrders.find((one) => one.id === order.id);
    expect(row?.isUnfinished).toBe(true);
    expect(new Date(row!.dueAt!).getTime()).toBe(new Date(order.dueAt!).getTime());

    // QC passed today: công đoạn worked today are released (P3110 REQ-A7);
    // Kích hoạt bảo hành no longer rides on the row (REQ-A8).
    expect((await receive(page, order.id, 1)).status).toBe(200);
    await passAll(page, order.id, [11]);
    stages = await stagesOf(page, line);
    expect(stages.get(stageA)?.completeLockedByLabo).toBe(false);
    expect(stages.get(stageB)?.completeLockedByLabo).toBe(false);
    expect(stages.get(stageB)?.completeLockedByLaboOrder).toBeNull();
    expect((await complete(stageA)).status).toBe(200);
    expect((await slipLine(page, line))?.labOrders.find((one) => one.id === order.id)?.isUnfinished).toBe(false);

    expect((await activateWarranty(page, order.id, [{ toothNumber: 11, startDate: clinicToday(), months: 12 }])).status).toBe(200);
    stages = await stagesOf(page, line);
    expect(stages.get(stageA)?.labo?.status).toBe(LaboStatus.Warranty);
    expect((await complete(stageB)).status).toBe(200);
  });

  test("QC passed today still holds a công đoạn worked yesterday, and names the day (P3110 REQ-A7)", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const today = clinicToday();
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const worked = await addStage(page, line, catalog.dentistId, `Labo hôm qua ${id}`, yesterday);
    const order = await sentOrder(
      page,
      orderBody(catalog, line, id, { teeth: [11], quantity: 1, treatmentServiceId: line.lineId, treatmentStageId: worked }),
    );
    expect((await receive(page, order.id, 1)).status).toBe(200);
    await passAll(page, order.id, [11]);

    // "ngày 10 pass 1 răng → ngày 10 vẫn khoá; ngày 11 pass hết → ngày 11 mới cho Hoàn thành".
    // Asked while yesterday is still the line's newest day, so only the Labo lock speaks.
    const before = await stagesOf(page, line);
    expect(before.get(worked)?.completeLockedByLabo).toBe(true);
    expect(before.get(worked)?.completeLockedByLaboOrder).toMatchObject({ orderId: order.id, qualityPassedOn: today });
    const held = await call(page, `${STAGES}/${worked}/complete`, { method: "POST", branchId: line.branchId });
    expect(held.status).toBe(403);
    expect(held.body.error?.code).toBe(code(31));

    const next = await addStage(page, line, catalog.dentistId, `Labo hôm nay ${id}`);
    const stages = await stagesOf(page, line);
    expect(stages.get(next)?.completeLockedByLabo).toBe(false);
    expect(stages.get(next)?.completeLockedByLaboOrder).toBeNull();
    // From today on, yesterday's row is also older than the line's newest day (F-88).
    expect(stages.get(worked)?.isDateLocked).toBe(true);
    const freed = await call(page, `${STAGES}/${next}/complete`, { method: "POST", branchId: line.branchId });
    expect(freed.status, freed.text).toBe(200);
  });

  test("a Nháp can be deleted, edited and checked against Ngày gửi; a cancelled order stays listed", async ({ page }) => {
    const id = runId();
    const target = await findLaboPatient(page);
    const catalog: LaboCatalog = await laboCatalog(page, target.branchId, id);
    const body = orderBody(catalog, target, id);

    const draft = await createOrder(page, body);
    expect(draft.status, draft.text).toBe(200);
    const self = `${LABO_ORDERS}/${draft.body.id}`;

    // Ngày trả hàng dự kiến not after Ngày gửi is refused; a later one keeps
    // only its day (P3110 REQ-C2): 09:30 is stored as that day's 00:00 in the
    // clinic's UTC+7.
    const tooEarly = await call(page, self, {
      method: "PUT",
      json: { ...body, dueAt: new Date(new Date(body.sentAt).getTime() - 60 * 60_000).toISOString() },
    });
    expect(tooEarly.status).toBe(403);
    expect(tooEarly.body.error?.code).toBe(code(13));
    const due = new Date(new Date(body.sentAt).getTime() + 2 * 24 * 60 * 60_000);
    due.setUTCHours(2, 30, 0, 0); // 09:30 in the clinic's UTC+7
    const saved = await call(page, self, { method: "PUT", json: { ...body, dueAt: due.toISOString(), teeth: [21, 22] } });
    expect(saved.status, saved.text).toBe(200);
    const reread = await read(page, draft.body.id!);
    expect(new Date(reread.dueAt!).getTime()).toBe(due.getTime() - (9 * 60 + 30) * 60_000);
    expect(reread.teeth.map((t) => t.toothNumber)).toEqual([21, 22]);

    const deleted = await call(page, self, { method: "DELETE" });
    expect(deleted.status, deleted.text).toBe(204);
    expect((await call(page, self)).status).toBe(404);
    expect(await listed(page, target.branchId, `PatientId=${target.patientId}`)).not.toContain(draft.body.id);

    const other = await createOrder(page, orderBody(catalog, target, `${id}c`));
    expect(other.status, other.text).toBe(200);
    const cancelled = await call<LaboOrderView>(page, `${LABO_ORDERS}/${other.body.id}/cancel`, { method: "POST" });
    expect(cancelled.status, cancelled.text).toBe(200);
    expect(cancelled.body.status).toBe(LaboStatus.Cancelled);
    expect((await read(page, other.body.id!)).status).toBe(LaboStatus.Cancelled);
    expect(await listed(page, target.branchId, `PatientId=${target.patientId}`)).toContain(other.body.id);
  });

  test("Gửi Labo takes no picture, keeps each tooth's spec and pictures (P3110 REQ-C1/C3)", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const body = orderBody(catalog, line, id, { treatmentServiceId: line.lineId });

    // No picture at all: sent (REQ-C3); the order-level spec went to both teeth.
    const bare = await createOrder(page, { ...body, submit: true });
    expect(bare.status, bare.text).toBe(200);
    expect(bare.body.status).toBe(LaboStatus.Sent);
    expect(bare.body.images).toHaveLength(0);
    expect((await read(page, bare.body.id!)).teeth.map((t) => [t.toothNumber, t.shade, t.finishLineId])).toEqual([
      [11, body.toothShade, catalog.finishLineId],
      [21, body.toothShade, catalog.finishLineId],
    ]);

    // Thông số từng răng as the dialog posts it: each tooth its own row.
    const specs = {
      "toothSpecs[0].toothNumber": 11,
      "toothSpecs[0].shade": "A1",
      "toothSpecs[0].finishLineId": catalog.finishLineId,
      "toothSpecs[0].labNote": `Mài sát nướu ${id}`,
      "toothSpecs[1].toothNumber": 21,
      "toothSpecs[1].shade": "A3",
      "toothSpecs[1].finishLineId": catalog.finishLineId,
    };
    // Six on one tooth are one too many: five per set.
    const crowded = await call(page, LABO_ORDERS, {
      method: "POST",
      branchId: body.branchId,
      form: { ...body, ...specs },
      toothPictures: [11, 11, 11, 11, 11, 11],
    });
    expect(crowded.status).toBe(403);
    expect(crowded.body.error?.code).toBe(code(16));

    const made = await call<LaboOrderView>(page, LABO_ORDERS, {
      method: "POST",
      branchId: body.branchId,
      form: { ...body, ...specs, submit: true },
      pictures: 1,
      toothPictures: [21, 21, 11],
    });
    expect(made.status, made.text).toBe(200);
    expect(made.body.status).toBe(LaboStatus.Sent);

    // Read back with a separate request.
    const back = await read(page, made.body.id!);
    expect(back.teeth.map((t) => [t.toothNumber, t.shade, t.finishLineId, t.labNote ?? null])).toEqual([
      [11, "A1", catalog.finishLineId, `Mài sát nướu ${id}`],
      [21, "A3", catalog.finishLineId, null],
    ]);
    const perSet = (tooth: number | null) => back.images.filter((i) => (i.toothNumber ?? null) === tooth).length;
    expect([perSet(null), perSet(11), perSet(21)]).toEqual([1, 1, 2]);
    for (const image of back.images) expect((await call(page, image.url)).status).toBe(200);
  });

  test("pictures dropped from a Nháp lose their row and their file", async ({ page }) => {
    const id = runId();
    const target = await findLaboPatient(page);
    const catalog = await laboCatalog(page, target.branchId, id);
    const body = orderBody(catalog, target, id);

    const added = await createOrder(page, body, 2);
    expect(added.status, added.text).toBe(200);
    expect(added.body.images).toHaveLength(2);
    const [first, second] = added.body.images!;
    expect((await call(page, first.url)).status).toBe(200);
    expect((await call(page, second.url)).status).toBe(200);

    // Six pictures are one too many, even for a Nháp.
    const tooMany = await call(page, `${LABO_ORDERS}/${added.body.id}`, {
      method: "PUT",
      form: { ...body, keepImageIds: [first.id, second.id] },
      pictures: 4,
    });
    expect(tooMany.status).toBe(403);
    expect(tooMany.body.error?.code).toBe(code(16));

    const trimmed = await call<LaboOrderView>(page, `${LABO_ORDERS}/${added.body.id}`, {
      method: "PUT",
      form: { ...body, keepImageIds: [first.id] },
    });
    expect(trimmed.status, trimmed.text).toBe(200);
    expect(trimmed.body.images?.map((i) => i.id)).toEqual([first.id]);

    // The kept picture still serves; the dropped one answers "Không tìm thấy ảnh".
    expect((await call(page, first.url)).status).toBe(200);
    const gone = await call(page, second.url);
    expect(gone.status).toBe(403);
    expect(gone.body.error?.code).toBe("BlueDental:Patient:0008");
    expect((await read(page, added.body.id!)).images.map((i) => i.id)).toEqual([first.id]);
  });

  test("an unfinished order blocks its service line until Hủy phiếu Labo", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));

    const lineUrl = `${PLANS}/${line.planId}/services/${line.lineId}`;
    const blocked = await call(page, `${lineUrl}/cancel`, { method: "POST", branchId: line.branchId });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error?.code).toBe("BlueDental:Treatment:0029");

    const cleared = await call<SlipRow>(page, `${lineUrl}/cancel-labo-orders`, { method: "POST", branchId: line.branchId });
    expect(cleared.status, cleared.text).toBe(200);
    const row = cleared.body.services?.find((one) => one.id === line.lineId);
    expect(row?.labOrders.find((one) => one.id === order.id)?.isUnfinished).toBe(false);
    expect((await read(page, order.id)).status).toBe(LaboStatus.Cancelled);

    const cancelled = await call<SlipRow>(page, `${lineUrl}/cancel`, { method: "POST", branchId: line.branchId });
    expect(cancelled.status, cancelled.text).toBe(200);
    expect(cancelled.body.services?.find((one) => one.id === line.lineId)?.status).toBe(4);
  });

  test("Hoàn thành dịch vụ waits until the line's labo orders pass QC or are cancelled", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const complete = () =>
      call<SlipRow>(page, `${PLANS}/${line.planId}/services/${line.lineId}/complete`, {
        method: "POST",
        branchId: line.branchId,
      });
    const expectLocked = async () => {
      const locked = await complete();
      expect(locked.status).toBe(403);
      expect(locked.body.error?.code).toBe(code(33));
      expect((await slipLine(page, line))?.status).not.toBe(3);
    };

    // A Nháp counts as unfinished (owner decision 9); cancelling it clears it.
    const draft = await createOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));
    expect(draft.status, draft.text).toBe(200);
    await expectLocked();
    expect((await call(page, `${LABO_ORDERS}/${draft.body.id}/cancel`, { method: "POST" })).status).toBe(200);

    const order = await sentOrder(
      page,
      orderBody(catalog, line, `${id}s`, { teeth: [11], quantity: 1, treatmentServiceId: line.lineId }),
    );
    await expectLocked();

    expect((await receive(page, order.id, 1)).status).toBe(200);
    await passAll(page, order.id, [11]);
    const done = await complete();
    expect(done.status, done.text).toBe(200);
    expect(done.body.services?.find((one) => one.id === line.lineId)?.status).toBe(3);
    expect((await slipLine(page, line))?.status).toBe(3);
  });

  test("an account without the Labo grants gets 403 and changes nothing", async ({ page, browser }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));

    const userName = `lb${id}`;
    const password = "Labo@123456";
    const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
      method: "POST",
      json: {
        userName,
        password,
        name: `Labo không quyền ${id}`,
        email: `${userName}@bluedental.local`,
        roleNames: ["dentist"],
        branchIds: [line.branchId],
        isActive: true,
      },
    });
    expect(staff.status, staff.text).toBe(200);

    const other = await openSession(browser, { userName, password });
    try {
      const self = `${LABO_ORDERS}/${order.id}`;
      expect((await call(other.page, self)).status).toBe(403);
      expect((await call(other.page, LABO_ORDERS, { branchId: line.branchId })).status).toBe(403);
      expect((await receive(other.page, order.id, 2)).status).toBe(403);
      expect((await call(other.page, `${self}/cancel`, { method: "POST" })).status).toBe(403);
      expect((await call(other.page, self, { method: "DELETE" })).status).toBe(403);
      expect(
        (await createOrder(other.page, orderBody(catalog, line, `${id}x`, { treatmentServiceId: line.lineId }))).status,
      ).toBe(403);
    } finally {
      await other.context.close();
      await call(page, `/api/v1/app/staff/${staff.body.id}`, { method: "DELETE" });
    }

    const after = await read(page, order.id);
    expect(after.status).toBe(LaboStatus.Sent);
    expect(after.rounds).toHaveLength(0);
  });

  test("an order answers only inside its own branch", async ({ page, browser }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));

    // branch2 holds the admin abilities but works in branch two only. It
    // sends no branch header: the header itself is not trusted yet (open gap,
    // memory branch-header-trust-gap / R-1064 proposal).
    const other = await openSession(browser, BRANCH2_USER);
    try {
      const self = `${LABO_ORDERS}/${order.id}`;
      expect((await call(other.page, self)).status).toBe(403);
      expect((await receive(other.page, order.id, 2)).status).toBe(403);
      expect((await call(other.page, `${self}/cancel`, { method: "POST" })).status).toBe(403);
      const list = await call<Paged<{ id: string }>>(other.page, `${LABO_ORDERS}?MaxResultCount=1000`);
      expect(list.status, list.text).toBe(200);
      expect(list.body.items?.some((one) => one.id === order.id)).toBe(false);
    } finally {
      await other.context.close();
    }

    const after = await read(page, order.id);
    expect(after.status).toBe(LaboStatus.Sent);
    expect(after.rounds).toHaveLength(0);
  });
});
