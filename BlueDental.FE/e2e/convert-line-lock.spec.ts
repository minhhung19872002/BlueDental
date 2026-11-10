import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createSlipViaApi } from "./fixtures/ledgerReceipt";
import { openStageDialog } from "./fixtures/stageDialog";

/**
 * R-1186 — "dịch vụ đã chuyển đổi rồi thì khóa luôn" (BA 2026-11-10). Once a
 * line is converted its công đoạn are history only: the line leaves TIẾP TỤC
 * CÔNG ĐOẠN, its LỊCH SỬ ĐIỀU TRỊ rows lose every write control and say why,
 * and the server refuses every write on them (BlueDental:Treatment:0066). Xóa
 * công đoạn stays with the admin, for a row written by mistake (owner's call).
 *
 * Real stack: real login, real API, real PostgreSQL; the fixtures are written
 * through the API with the browser's own session, nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const STAGES = "/api/v1/app/treatment-stages";
const PLANS = "/api/v1/app/patient-treatments";
const LINE_CLOSED = "BlueDental:Treatment:0066";

interface Reply {
  status: number;
  json: Record<string, unknown> | null;
  text: string;
}

/** One API call from inside the page, with the session, the antiforgery and the branch header. */
async function api(page: Page, method: "GET" | "POST" | "PUT" | "DELETE", url: string, body?: unknown): Promise<Reply> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: Record<string, unknown> | null;
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        json = null; // a non-JSON body: the status and the text tell
      }
      return { status: res.status, json, text };
    },
    { method, url, body, branch: BRANCH },
  );
}

/** The write was refused as a closed line's, not for any other reason. */
function expectLineClosed(reply: Reply): void {
  expect(reply.status, reply.text).toBeGreaterThanOrEqual(400);
  expect(reply.status, reply.text).toBeLessThan(500);
  expect(reply.text).toContain(LINE_CLOSED);
}

test("a converted line's công đoạn are read-only, on screen and on the server", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1700, height: 950 });
  await login(page);

  // ── A patient of its own, one slip, one open công đoạn on its line ──────
  const suffix = runId();
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const patient = await api(page, "POST", "/api/v1/app/patients", {
    firstName: `Khoá chuyển đổi ${suffix}`,
    lastName: "E2E",
    dateOfBirth: null,
    gender: "male",
    phoneNumber: `0377${suffix}`,
  });
  expect(patient.status, patient.text).toBe(200);
  const patientId = String(patient.json?.id);

  const slip = await createSlipViaApi(page, patientId, [46]);
  const plan = await api(page, "GET", `${PLANS}/${slip.id}`);
  const [line] = (plan.json as { services: { id: string; serviceId: string; serviceName: string | null }[] })
    .services;
  const staff = await api(page, "GET", "/api/v1/app/staff?MaxResultCount=1&Role=1");
  const staffId = (staff.json as { items: { id: string }[] }).items[0].id;

  const note = `e2e trước chuyển đổi ${suffix}`;
  const created = await api(page, "POST", STAGES, {
    patientId,
    clinicBranchId: BRANCH,
    treatmentId: slip.id,
    treatmentServiceId: line.id,
    serviceId: line.serviceId,
    name: line.serviceName || "e2e",
    note,
    staffId,
    teeth: [{ toothCode: 46, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
  });
  expect(created.status, created.text).toBe(200);
  const stageId = String(created.json?.id);

  // ── Chuyển đổi → Dịch vụ cũ: the line closes as "Chuyển đổi" ────────────
  const converted = await api(page, "POST", `${PLANS}/${slip.id}/services/${line.id}/convert`, {
    conversionType: 2,
    serviceId: null,
    paymentAmount: null,
    differenceHandling: null,
    note: "R-1186 khoá dịch vụ đã chuyển đổi",
    teeth: [{ toothCode: 46, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    diagnoserStaffId: staffId,
    secondDiagnoserStaffId: null,
    consultantStaffId: staffId,
    secondConsultantStaffId: null,
  });
  expect(converted.status, converted.text).toBe(200);

  // ── The server refuses every write on the closed line's công đoạn ───────
  expectLineClosed(await api(page, "PUT", `${STAGES}/${stageId}/note`, { note: "sửa sau chuyển đổi" }));
  expectLineClosed(await api(page, "PUT", `${STAGES}/${stageId}/remark`, { remark: "ghi chú sau chuyển đổi" }));
  expectLineClosed(await api(page, "POST", `${STAGES}/${stageId}/complete`));
  expectLineClosed(
    await api(page, "POST", `${STAGES}/${stageId}/continue`, {
      staffId,
      note: "tiếp tục sau chuyển đổi",
      serviceItemIds: [],
      toothCodes: [46],
    }),
  );
  expectLineClosed(
    await api(page, "POST", STAGES, {
      patientId,
      clinicBranchId: BRANCH,
      treatmentId: slip.id,
      treatmentServiceId: line.id,
      serviceId: line.serviceId,
      name: "thêm sau chuyển đổi",
      note: "thêm sau chuyển đổi",
      staffId,
      teeth: [{ toothCode: 46, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    }),
  );

  // Read back on its own request: nothing moved.
  const stored = await api(page, "GET", `${STAGES}/${stageId}`);
  expect(stored.status, stored.text).toBe(200);
  expect(stored.json?.note).toBe(note);
  expect(stored.json?.remark ?? null).toBeNull();
  expect(stored.json?.completedAt ?? null).toBeNull();
  const lineStages = await api(page, "GET", `${STAGES}?TreatmentServiceId=${line.id}&MaxResultCount=50`);
  expect((lineStages.json as { totalCount: number }).totalCount).toBe(1);

  // ── On screen: off TIẾP TỤC CÔNG ĐOẠN, the row read-only and saying why ─
  const panel = await openStageDialog(page, { patientId, planId: slip.id, branchId: BRANCH });
  await expect(panel.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).locator("em")).toHaveText("0");

  const row = panel.locator(`.pd-stage-histrow[data-stage-id="${stageId}"]`);
  await expect(row).toHaveAttribute("data-line-closed", "true");
  await expect(row).toContainText("Khoá: dịch vụ đã chuyển đổi, chỉ xem");
  await expect(row.getByRole("button", { name: "Sửa ghi chú" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Sửa cột Ghi chú" })).toHaveCount(0);
  await expect(row.getByRole("checkbox", { name: "Hoàn thành" })).toBeDisabled();
  await expect(row.getByRole("button", { name: "Tải ảnh" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Tạo Labo" })).toHaveCount(0);

  // ── Xóa công đoạn stays with the admin (owner's call) ───────────────────
  await expect(row.getByRole("button", { name: "Xóa công đoạn" })).toBeVisible();
  const removed = await api(page, "DELETE", `${STAGES}/${stageId}`);
  expect(removed.status, removed.text).toBeLessThan(300);
  expect((await api(page, "GET", `${STAGES}/${stageId}`)).status).toBe(404);
});
