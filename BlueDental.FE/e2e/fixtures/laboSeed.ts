import { expect, type Page } from "@playwright/test";
import { assertRealApiTraffic } from "./auth";

/**
 * Seeding for the labo specs: a patient of the demo clinic and one Đặt mới
 * order on it, created through the same endpoints the dialog posts to, with
 * the cookie the browser holds after the real login. No API is intercepted.
 */

export interface LaboTarget {
  patientId: string;
  patientCode: string;
  patientName: string;
  branchId: string;
}

/** A service line of a treatment slip, with the patient the slip belongs to. */
export interface PlanLineTarget extends LaboTarget {
  planId: string;
  lineId: string;
}

export interface SeededLaboOrder {
  id: string;
  orderCode: string;
  supplierName: string;
  teeth: string;
  shade: string;
  instruction: string;
}

/** Any patient of the demo clinic, with the branch its record belongs to. */
export async function findLaboPatient(page: Page): Promise<LaboTarget> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const found = await page.evaluate(async () => {
    const list = (await (
      await fetch("/api/v1/app/patients?maxResultCount=1", { credentials: "include" })
    ).json()) as { items: { id: string }[] };
    const id = list.items[0]?.id;
    if (!id) return null;
    const patient = (await (
      await fetch(`/api/v1/app/patients/${id}`, { credentials: "include" })
    ).json()) as { id: string; patientCode: string; fullName: string; branchId: string };
    return {
      patientId: patient.id,
      patientCode: patient.patientCode,
      patientName: patient.fullName,
      branchId: patient.branchId,
    };
  });
  expect(found, "the demo clinic should have a patient").toBeTruthy();
  return found!;
}

/**
 * A fresh service line on a slip of the demo clinic, added through the slip's
 * own `POST services` with the catalog service and price of one of its open
 * lines. Without `planId` the first slip that has an open line is used. The
 * line starts Created; the spec drives it from there, so no seeded line is
 * used up.
 */
export async function addPlanLine(page: Page, planId?: string): Promise<PlanLineTarget> {
  if (!planId) {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
  }
  const found = await page.evaluate(
    async ({ planId }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const plans = (await (
        await fetch("/api/v1/app/patient-treatments?maxResultCount=50", { credentials: "include" })
      ).json()) as {
        items: {
          id: string;
          patientId: string;
          branchId: string;
          services: { id: string; serviceId: string; price: number; status: number }[];
        }[];
      };
      const plan = planId
        ? plans.items.find((one) => one.id === planId)
        : plans.items.find((one) => one.services.some((line) => line.status === 1 || line.status === 2));
      const sample = plan?.services.find((line) => line.status === 1 || line.status === 2) ?? plan?.services[0];
      if (!plan || !sample) return null;
      const headers = {
        "content-type": "application/json",
        "X-Clinic-Branch-Id": plan.branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const res = await fetch(`/api/v1/app/patient-treatments/${plan.id}/services`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          serviceId: sample.serviceId,
          price: sample.price,
          quantity: 1,
          discountType: 0,
          discountValue: 0,
        }),
      });
      if (!res.ok) throw new Error(`POST services → ${res.status} ${await res.text()}`);
      const slip = (await res.json()) as { services: { id: string }[] };
      // The slip lists lines in its own order, so the new one is the id that was not there before.
      const before = new Set(plan.services.map((line) => line.id));
      const newest = slip.services.find((line) => !before.has(line.id));
      if (!newest) throw new Error("POST services returned no new line");
      const patient = (await (
        await fetch(`/api/v1/app/patients/${plan.patientId}`, { credentials: "include" })
      ).json()) as { id: string; patientCode: string; fullName: string; branchId: string };
      return {
        planId: plan.id,
        lineId: newest.id,
        patientId: patient.id,
        patientCode: patient.patientCode,
        patientName: patient.fullName,
        branchId: patient.branchId,
      };
    },
    { planId },
  );
  expect(found, "the demo clinic should have a slip with an open service line").toBeTruthy();
  return found!;
}

/**
 * One of the slip's line actions — `complete`, `cancel` or
 * `cancel-labo-orders` — posted the way the plan detail posts it.
 */
export async function driveLine(
  page: Page,
  line: PlanLineTarget,
  action: "complete" | "cancel" | "cancel-labo-orders",
): Promise<void> {
  const status = await page.evaluate(
    async ({ line, action }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(
        `/api/v1/app/patient-treatments/${line.planId}/services/${line.lineId}/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "X-Clinic-Branch-Id": line.branchId,
            ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
          },
        },
      );
      return { status: res.status, body: await res.text() };
    },
    { line, action },
  );
  expect(status.status, `POST …/${action}: ${status.body}`).toBe(200);
}

/**
 * One Đặt mới order with every field the modal reads out, posted the way the
 * dialog posts it. The supplier is created only when the branch has none.
 * With `treatmentServiceId` the order hangs off that service line, as one
 * raised from the plan row does.
 */
export async function seedLaboOrder(
  page: Page,
  target: LaboTarget,
  id: string,
  treatmentServiceId?: string,
): Promise<SeededLaboOrder> {
  return page.evaluate(
    async ({ target, id, treatmentServiceId }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers = {
        "content-type": "application/json",
        "X-Clinic-Branch-Id": target.branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const post = async (url: string, body: unknown) => {
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
        return (await res.json()) as { id: string; name: string; orderCode: string };
      };

      const suppliers = (await (
        await fetch(
          `/api/v1/app/labo-suppliers?ClinicBranchId=${target.branchId}&IsActive=true&MaxResultCount=1`,
          { credentials: "include", headers },
        )
      ).json()) as { items: { name: string }[] };
      const supplierName =
        suppliers.items[0]?.name ??
        (
          await post("/api/v1/app/labo-suppliers", {
            name: `Labo e2e ${id}`,
            email: `labo-${id}@example.com`,
            clinicBranchId: target.branchId,
          })
        ).name;

      const order = {
        patientId: target.patientId,
        branchId: target.branchId,
        labProviderName: supplierName,
        kind: 1,
        estimatedCost: 0,
        quantity: 2,
        toothNumbers: "11, 12",
        toothShade: `A2-${id}`,
        workDescription: `Chỉ định e2e ${id}`,
        sentAt: new Date().toISOString(),
        ...(treatmentServiceId ? { treatmentServiceId } : {}),
      };
      const saved = await post("/api/v1/app/labo-orders", order);
      return {
        id: saved.id,
        orderCode: saved.orderCode,
        supplierName,
        teeth: order.toothNumbers,
        shade: order.toothShade,
        instruction: order.workDescription,
      };
    },
    { target, id, treatmentServiceId },
  );
}
