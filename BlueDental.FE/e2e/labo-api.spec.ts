import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import { findLaboPatient, seedLaboOrder, type LaboTarget } from "./fixtures/laboSeed";

/**
 * Feature: Labo orders — the rules the API keeps on its own, whatever the
 * dialogs do (docs/clone/api.md, Labo; R-493..R-497).
 *
 * Every call here is a real HTTP request issued from inside the logged-in
 * page, with the cookie the real login left and the antiforgery token the
 * server set — the same way the app's own axios client calls. No route is
 * intercepted, no token is injected, and the database is the real one.
 *
 * The repo's ABP host test base cannot start (see docs/testing), so this is
 * where `SaveDetailAsync`, the due-after-sent guard and the branch guard are
 * exercised over the real request pipeline.
 */

const PNG_1PX_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

interface ApiResult {
  status: number;
  body: {
    error?: { code?: string; message?: string };
    status?: number;
    receivedAt?: string | null;
    sentAt?: string | null;
    dueAt?: string | null;
    labProviderName?: string;
    toothNumbers?: string | null;
    workDescription?: string | null;
    notes?: string | null;
    estimatedCost?: number;
    images?: { id: string; url: string }[];
    items?: { id: string; status?: number }[];
    totalCount?: number;
    awaitingReturn?: number;
    overdue?: number;
    returned?: number;
    kind?: number;
    id?: string;
    services?: {
      id: string;
      status: number;
      labOrders: { id: string; isUnfinished: boolean; kind: number; status: number }[];
    }[];
  };
}

interface CallOptions {
  method?: "GET" | "PUT" | "POST";
  branchId?: string;
  json?: unknown;
  /** Sent as multipart/form-data; a `files` entry is a 1×1 PNG under that field. */
  form?: Record<string, string | string[]>;
  files?: { field: string; name: string }[];
}

/** One request from the logged-in page: cookie session + antiforgery header. */
async function call(page: Page, url: string, options: CallOptions = {}): Promise<ApiResult> {
  return page.evaluate(
    async ({ url, options, png }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        ...(options.branchId ? { "X-Clinic-Branch-Id": options.branchId } : {}),
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      let body: BodyInit | undefined;
      if (options.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.json);
      } else if (options.form) {
        const form = new FormData();
        for (const [key, value] of Object.entries(options.form)) {
          for (const one of Array.isArray(value) ? value : [value]) form.append(key, one);
        }
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        for (const file of options.files ?? []) {
          form.append(file.field, new Blob([bytes], { type: "image/png" }), file.name);
        }
        body = form;
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
      return { status: res.status, body: parse() as ApiResult["body"] };
    },
    { url, options, png: PNG_1PX_BASE64 },
  );
}

const ORDERS = "/api/v1/app/labo-orders";
const PLANS = "/api/v1/app/patient-treatments";

/**
 * A fresh service line on a plan of the demo clinic: the same catalog service
 * and price as one of the plan's open lines, added through the plan's own
 * `POST services`. The specs cancel it afterwards, so no seeded line is used up.
 */
async function addServiceLine(page: Page): Promise<{
  planId: string;
  lineId: string;
  patientId: string;
  branchId: string;
}> {
  const found = await page.evaluate(async (plans) => {
    const res = await fetch(`${plans}?maxResultCount=50`, { credentials: "include" });
    const items = (await res.json()).items as {
      id: string;
      patientId: string;
      branchId: string;
      services: { serviceId: string; price: number; status: number }[];
    }[];
    for (const plan of items) {
      const line = plan.services.find((one) => one.status === 1 || one.status === 2);
      if (line)
        return { planId: plan.id, patientId: plan.patientId, branchId: plan.branchId, line };
    }
    return null;
  }, PLANS);
  expect(found, "the demo clinic should have a slip with an open service line").toBeTruthy();
  const { planId, patientId, branchId, line } = found!;
  const added = await call(page, `${PLANS}/${planId}/services`, {
    method: "POST",
    branchId,
    json: {
      serviceId: line.serviceId,
      price: line.price,
      quantity: 1,
      discountType: 0,
      discountValue: 0,
    },
  });
  expect(added.status).toBe(200);
  const lines = added.body.services ?? [];
  const newest = lines[lines.length - 1];
  expect(newest, "the plan should answer with the added line").toBeTruthy();
  return { planId, lineId: newest.id, patientId, branchId };
}

async function loginAsBranchTwo(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, BRANCH2_USER);
  return page;
}

test.describe("Labo order API rules", () => {
  let target: LaboTarget;

  test.beforeEach(async ({ page }) => {
    await login(page);
    target = await findLaboPatient(page);
  });

  test("the due stamp keeps its hour and must follow the sent stamp", async ({ page }) => {
    const seeded = await seedLaboOrder(page, target, runId());
    const before = await call(page, `${ORDERS}/${seeded.id}`);
    expect(before.status).toBe(200);
    expect(before.body.sentAt).toBeTruthy();
    const sentAt = new Date(before.body.sentAt!);

    const update = {
      labProviderName: before.body.labProviderName,
      toothNumbers: before.body.toothNumbers,
      workDescription: before.body.workDescription,
      notes: before.body.notes,
      estimatedCost: before.body.estimatedCost,
    };

    // An hour before the sent stamp: refused with the reference's rule.
    const tooEarly = await call(page, `${ORDERS}/${seeded.id}`, {
      method: "PUT",
      json: { ...update, dueAt: new Date(sentAt.getTime() - 60 * 60_000).toISOString() },
    });
    expect(tooEarly.status).toBe(403);
    expect(tooEarly.body.error?.code).toBe("BlueDental:Labo:0013");

    // Two days later at 09:30 — the hour survives the round trip.
    const due = new Date(sentAt.getTime() + 2 * 24 * 60 * 60_000);
    due.setUTCHours(2, 30, 0, 0); // 09:30 in the clinic's UTC+7
    const saved = await call(page, `${ORDERS}/${seeded.id}`, {
      method: "PUT",
      json: { ...update, dueAt: due.toISOString() },
    });
    expect(saved.status).toBe(200);

    const after = await call(page, `${ORDERS}/${seeded.id}`);
    expect(after.body.dueAt).toBeTruthy();
    expect(new Date(after.body.dueAt!).getTime()).toBe(due.getTime());
  });

  test("the detail status obeys the workflow", async ({ page }) => {
    const seeded = await seedLaboOrder(page, target, runId());
    const detail = `${ORDERS}/${seeded.id}/detail`;

    // Sent (2) is reached through /send only, never through the dialog.
    const sent = await call(page, detail, { method: "PUT", form: { status: "2" } });
    expect(sent.status).toBe(422);
    expect(sent.body.error?.code).toBe("BlueDental:Labo:0002");

    // Received (4) from the dialog stamps the receipt.
    const received = await call(page, detail, { method: "PUT", form: { status: "4" } });
    expect(received.status).toBe(200);
    expect(received.body.status).toBe(4);
    expect(received.body.receivedAt).toBeTruthy();

    // A received order is no longer new, so it cannot be cancelled (6).
    const cancelled = await call(page, detail, { method: "PUT", form: { status: "6" } });
    expect(cancelled.status).toBe(403);
    expect(cancelled.body.error?.code).toBe("BlueDental:Labo:0012");

    const reread = await call(page, `${ORDERS}/${seeded.id}`);
    expect(reread.body.status).toBe(4);
  });

  test("the Mẫu Labo filters are exact status filters", async ({ page }) => {
    // Staging, 2026-09-24: the tabs send status=created|lateDelivery|delivered
    // and nothing else — an order due back months earlier still sat under
    // "chưa nhận", and "giao trễ" held only what the dialog had filed there.
    const seeded = await seedLaboOrder(page, target, runId());
    const idsUnder = async (filter: number) => {
      const res = await call(
        page,
        `${ORDERS}?sampleFilter=${filter}&patientId=${target.patientId}&maxResultCount=200`,
      );
      expect(res.status).toBe(200);
      return res.body.items!.map((one) => one.id);
    };
    const counters = async () => {
      const res = await call(page, `${ORDERS}/stats?patientId=${target.patientId}`);
      expect(res.status).toBe(200);
      return res.body;
    };

    // A fresh order (Đơn hàng mới) is "chưa nhận" and nowhere else.
    const before = await counters();
    expect(await idsUnder(1)).toContain(seeded.id);
    expect(await idsUnder(2)).not.toContain(seeded.id);
    expect(await idsUnder(3)).not.toContain(seeded.id);
    expect(before.awaitingReturn).toBeGreaterThan(0);

    // Filed as Giao trễ (7) from the dialog: leaves "chưa nhận", enters "giao trễ".
    const late = await call(page, `${ORDERS}/${seeded.id}/detail`, { method: "PUT", form: { status: "7" } });
    expect(late.status).toBe(200);
    expect(await idsUnder(2)).toContain(seeded.id);
    expect(await idsUnder(1)).not.toContain(seeded.id);
    const whileLate = await counters();
    expect(whileLate.awaitingReturn).toBe(before.awaitingReturn! - 1);
    expect(whileLate.overdue).toBe(before.overdue! + 1);

    // Received (4): "đã nhận hàng" only, and the counters follow.
    const received = await call(page, `${ORDERS}/${seeded.id}/detail`, { method: "PUT", form: { status: "4" } });
    expect(received.status).toBe(200);
    expect(await idsUnder(3)).toContain(seeded.id);
    expect(await idsUnder(2)).not.toContain(seeded.id);
    expect(await idsUnder(1)).not.toContain(seeded.id);
    const afterReceipt = await counters();
    expect(afterReceipt.overdue).toBe(before.overdue);
    expect(afterReceipt.returned).toBe(before.returned! + 1);
  });

  test("an unfinished order blocks its service line until Hủy phiếu Labo", async ({ page }) => {
    // The reference's statusClinic (staging, 2026-09-24): `POST …/cancel` on a
    // line with an unfinished labo order is refused, the Chuyển đổi dialog's
    // Hủy phiếu Labo closes every open order of the line, and only then does
    // the line accept the cancel.
    const { planId, lineId, patientId, branchId } = await addServiceLine(page);
    // The seed only settles the supplier; the order under test is raised on
    // the line the way the plan row's "Tạo phiếu Labo" does.
    const { supplierName } = await seedLaboOrder(page, target, runId());
    const raised = await call(page, ORDERS, {
      method: "POST",
      json: {
        patientId,
        branchId,
        labProviderName: supplierName,
        kind: 1,
        quantity: 1,
        toothNumbers: "21",
        workDescription: `statusClinic e2e ${runId()}`,
        sentAt: new Date().toISOString(),
        treatmentServiceId: lineId,
      },
    });
    expect(raised.status).toBe(200);
    const orderId = raised.body.id!;

    const line = `${PLANS}/${planId}/services/${lineId}`;
    const blocked = await call(page, `${line}/cancel`, { method: "POST" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error?.code).toBe("BlueDental:Treatment:0029");

    const cleared = await call(page, `${line}/cancel-labo-orders`, { method: "POST" });
    expect(cleared.status).toBe(200);
    const slipLine = cleared.body.services?.find((one) => one.id === lineId);
    expect(slipLine?.labOrders.map((one) => one.id)).toContain(orderId);
    expect(slipLine?.labOrders.every((one) => !one.isUnfinished)).toBe(true);

    // Both dimensions closed: Tình trạng mẫu "Đã huỷ" (kind 4) and status Rejected (6).
    const reread = await call(page, `${ORDERS}/${orderId}`);
    expect(reread.body.kind).toBe(4);
    expect(reread.body.status).toBe(6);

    const cancelled = await call(page, `${line}/cancel`, { method: "POST" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.services?.find((one) => one.id === lineId)?.status).toBe(4);
  });

  test("pictures dropped from the detail lose their row and their file", async ({ page }) => {
    const seeded = await seedLaboOrder(page, target, runId());
    const detail = `${ORDERS}/${seeded.id}/detail`;

    const added = await call(page, detail, {
      method: "PUT",
      form: { status: "1" },
      files: [
        { field: "pictures", name: "one.png" },
        { field: "pictures", name: "two.png" },
      ],
    });
    expect(added.status).toBe(200);
    expect(added.body.images).toHaveLength(2);
    const [first, second] = added.body.images!;
    expect((await call(page, first.url)).status).toBe(200);
    expect((await call(page, second.url)).status).toBe(200);

    const trimmed = await call(page, detail, {
      method: "PUT",
      form: { status: "1", keepImageIds: [first.id] },
    });
    expect(trimmed.status).toBe(200);
    expect(trimmed.body.images?.map((i) => i.id)).toEqual([first.id]);

    // The kept picture still serves; the dropped one answers the app's
    // "Không tìm thấy ảnh" (a business error, so 403 as everywhere in F-24).
    expect((await call(page, first.url)).status).toBe(200);
    const gone = await call(page, second.url);
    expect(gone.status).toBe(403);
    expect(gone.body.error?.code).toBe("BlueDental:Patient:0008");

    const reread = await call(page, `${ORDERS}/${seeded.id}`);
    expect(reread.body.images?.map((i) => i.id)).toEqual([first.id]);
  });

  test("an order answers only inside its own branch", async ({ page, browser }) => {
    const seeded = await seedLaboOrder(page, target, runId());

    // branch2 holds the admin abilities but is assigned to branch two only.
    const other = await loginAsBranchTwo(browser);
    try {
      const read = await call(other, `${ORDERS}/${seeded.id}`);
      expect(read.status).toBe(403);

      const write = await call(other, `${ORDERS}/${seeded.id}/detail`, {
        method: "PUT",
        form: { status: "4" },
      });
      expect(write.status).toBe(403);

      const list = await call(other, `${ORDERS}?maxResultCount=100`);
      expect(list.status).toBe(200);
      expect(list.body.items?.some((i) => i.id === seeded.id)).toBe(false);
    } finally {
      await other.context().close();
    }

    // Untouched by the refused write.
    const reread = await call(page, `${ORDERS}/${seeded.id}`);
    expect(reread.body.status).toBe(1);
  });
});
