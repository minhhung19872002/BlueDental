import { expect, type Page } from "@playwright/test";

/**
 * Real-HTTP helpers for the Danh mục combo specs: each call is a fetch from
 * the logged-in page, carrying its own cookie and XSRF token — nothing is
 * injected or intercepted.
 */

export const ENTRIES = "/api/v1/app/catalog-entries";
export const TAXONOMIES = "/api/v1/app/taxonomies";
export const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
export const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

export const SINGLE = 0;
export const COMBO = 1;
export const TAX_KCT = 0;
export const TAX_EIGHT = 4;

export interface ComboItem {
  componentEntryId: string;
  quantity: number;
  unitAmount: number;
  name?: string | null;
  unitPrice?: number;
  isDeleted?: boolean;
}

export interface Entry {
  id: string;
  name: string;
  price: number | null;
  isDeleted: boolean;
  serviceConfig: {
    kind: number;
    taxRate: number;
    priceIncludesTax: boolean;
    discountValue: number;
    priceAfterDiscount: number;
    amountCollected: number;
    taxAmount: number;
  } | null;
  comboItems: ComboItem[];
}

export interface ApiResult<T> {
  status: number;
  body: T & { error?: { code?: string }; items?: Entry[] };
}

export async function call<T>(page: Page, method: string, url: string, json?: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, url, json }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
        "accept-language": "vi",
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      if (json !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      return { status: res.status, body: body as never };
    },
    { method, url, json },
  );
}

export function config(kind: number, taxRate = TAX_KCT, priceIncludesTax = false) {
  return {
    kind,
    taxRate,
    priceIncludesTax,
    discountIsPercent: true,
    discountValue: 0,
    requireImage: false,
    deductDoctorOnWarranty: false,
    separateRevenue: false,
    showToothOnInvoice: false,
    revenueByStage: false,
    requireStageSequence: false,
    warrantyDays: 0,
    laboSupplierIds: [] as string[],
  };
}

export async function createGroup(page: Page, branchId: string, name: string): Promise<string> {
  const res = await call<{ id: string }>(page, "POST", TAXONOMIES, {
    clinicBranchId: branchId,
    group: "care_service",
    name,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.id;
}

export async function createSingle(page: Page, taxonomyId: string, name: string, price: number): Promise<Entry> {
  const res = await call<Entry>(page, "POST", ENTRIES, {
    taxonomyId,
    name,
    price,
    serviceConfig: config(SINGLE),
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

export async function getEntry(page: Page, id: string): Promise<Entry> {
  const res = await call<Entry>(page, "GET", `${ENTRIES}/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}
