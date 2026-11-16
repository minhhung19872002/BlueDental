import { expect, type Page } from "@playwright/test";

/**
 * A Danh mục service with "Giá sau giảm" below its list price, written through
 * the real API with the browser's own session — the price Chọn dịch vụ,
 * Chuyển đổi (R-1184) and Thêm dịch vụ phát sinh (R-1235) sell at.
 */

export const PLANS_API = "/api/v1/app/patient-treatments";

/** 300.000 đ with 10% off: "Giá sau giảm" 270.000 đ. */
export const LIST_PRICE = 300_000;
export const SALE_PRICE = 270_000;

export const vnd = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

export interface ApiCall {
  method: "POST" | "GET" | "PUT";
  url: string;
  body?: unknown;
}

export interface ApiAnswer<T> {
  status: number;
  body: T;
}

/** The browser's own fetch: its cookie, its XSRF token, the patient's branch. */
export async function browserFetch<T>(page: Page, branch: string, call: ApiCall): Promise<ApiAnswer<T>> {
  return page.evaluate(
    async ({ branch, call }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(call.url, {
        method: call.method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    { branch, call },
  ) as Promise<ApiAnswer<T>>;
}

/** {@link browserFetch} for calls that must succeed. */
export async function api<T>(page: Page, branch: string, call: ApiCall): Promise<T> {
  const answer = await browserFetch<T>(page, branch, call);
  if (answer.status >= 400) throw new Error(`${call.method} ${call.url} ${answer.status} ${JSON.stringify(answer.body)}`);
  return answer.body;
}

/** The branch the patient's record lives in. */
export async function patientBranch(page: Page, patientId: string): Promise<string> {
  const { branchId } = await api<{ branchId: string }>(page, "", {
    method: "GET",
    url: `/api/v1/app/patients/${patientId}`,
  });
  return branchId;
}

/**
 * A service named `name` at {@link LIST_PRICE} with 10% off. The entry stays:
 * once a line uses it Danh mục refuses to delete it (Catalogs:0033), and the
 * caller's run id keeps other specs off it.
 */
export async function createSaleService(page: Page, branch: string, name: string): Promise<{ id: string }> {
  const groups = await api<{ items: { id: string }[] }>(page, branch, {
    method: "GET",
    url: `/api/v1/app/taxonomies?ClinicBranchId=${branch}&Group=care_service&MaxResultCount=1`,
  });
  const entry = await api<{ id: string; serviceConfig: { priceAfterDiscount: number } }>(page, branch, {
    method: "POST",
    url: "/api/v1/app/catalog-entries",
    body: {
      clinicBranchId: branch,
      taxonomyId: groups.items[0].id,
      name,
      price: LIST_PRICE,
      serviceConfig: {
        taxRate: 0,
        priceIncludesTax: false,
        discountIsPercent: true,
        discountValue: 10,
        requireImage: false,
        deductDoctorOnWarranty: false,
        separateRevenue: false,
        showToothOnInvoice: false,
        revenueByStage: false,
        requireStageSequence: false,
        warrantyDays: 0,
        laboSupplierIds: [],
      },
      stages: [],
    },
  });
  expect(entry.serviceConfig.priceAfterDiscount).toBe(SALE_PRICE);
  return entry;
}

export interface SavedLine {
  serviceId: string;
  price: number;
  originalPrice: number;
  effectiveAmount: number;
}

/** The slip read back on a separate request. */
export async function slipLines(page: Page, branch: string, slipId: string): Promise<SavedLine[]> {
  const saved = await api<{ services: SavedLine[] }>(page, branch, { method: "GET", url: `${PLANS_API}/${slipId}` });
  return saved.services;
}
