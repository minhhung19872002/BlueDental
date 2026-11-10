import { createHash } from "node:crypto";
import { expect, type Page } from "@playwright/test";

import { runId } from "./auth";
import { call } from "./timekeepingStaff";

/**
 * Zalo's side of a chat for specs that run on the local stub
 * (e2e/fixtures/zalo-stub.mjs), never the real OA: the stub OA linked to a
 * branch the way a manager links one, and webhooks signed the way Zalo signs
 * them. Host env: Zalo__AppId=e2e-app, Zalo__AppSecret=e2e-app-secret,
 * Zalo__WebhookSecret=e2e-webhook-secret, Zalo__OaId=stub-oa and the three
 * base URLs on the stub.
 */

const ZALO = "/api/v1/app/zalo";
const APP_ID = process.env.E2E_ZALO_APP_ID ?? "e2e-app";
const WEBHOOK_SECRET = process.env.E2E_ZALO_WEBHOOK_SECRET ?? "e2e-webhook-secret";
export const STUB_OA_ID = process.env.E2E_ZALO_OA_ID ?? "stub-oa";

/** A Zalo user id no earlier run used: digits, like Zalo's. */
export function zaloUser(): string {
  return `45${runId()}${String(Math.floor(Math.random() * 9000 + 1000))}`;
}

/** Signs and posts a webhook event the way Zalo does: mac = sha256(appId + body + timestamp + secret). */
export async function webhook(page: Page, event: Record<string, unknown>): Promise<void> {
  const timestamp = String(event.timestamp ?? Date.now());
  const body = JSON.stringify({ app_id: APP_ID, timestamp, ...event });
  const mac = createHash("sha256").update(APP_ID + body + timestamp + WEBHOOK_SECRET).digest("hex");
  const res = await page.request.post(`${ZALO}/webhook`, {
    data: body,
    headers: { "content-type": "application/json", "X-ZEvent-Signature": `mac=${mac}` },
  });
  expect(res.status()).toBe(200);
}

/** The customer writes to the OA. */
export async function customerWrites(page: Page, userId: string, text: string, at = Date.now()): Promise<void> {
  await webhook(page, {
    event_name: "user_send_text",
    timestamp: String(at),
    sender: { id: userId },
    recipient: { id: STUB_OA_ID },
    message: { msg_id: `in-${userId}-${at}`, text },
  });
}

/** The OA writes to the customer from Zalo's own app: the echo Zalo sends back. */
export async function oaWrites(page: Page, userId: string, text: string, at = Date.now()): Promise<void> {
  await webhook(page, {
    event_name: "oa_send_text",
    timestamp: String(at),
    sender: { id: STUB_OA_ID },
    recipient: { id: userId },
    message: { msg_id: `out-${userId}-${at}`, text },
  });
}

/**
 * Links the stub OA to `branchId` if it is not linked yet: the signed state
 * from connect-url comes back on Zalo's redirect, and the stub takes any code.
 * Resolves whether this call linked it, so the caller unlinks only its own.
 */
export async function linkStubOa(page: Page, branchId: string): Promise<boolean> {
  const status = await call<{ isConnected: boolean }>(page, `${ZALO}/status`, { branchId });
  if (status.body.isConnected) return false;
  const connect = await call<{ url: string }>(page, `${ZALO}/connect-url`, { branchId });
  expect(connect.status, "connect-url needs the host's Zalo app credentials").toBe(200);
  const state = new URL(connect.body.url).searchParams.get("state") ?? "";
  const callback = await page.request.get(`${ZALO}/oauth/callback`, {
    params: { code: "stub-code", state },
    maxRedirects: 0,
  });
  expect(callback.headers().location).toContain("zalo=connected");
  return true;
}

export async function unlinkStubOa(page: Page, branchId: string): Promise<void> {
  const unlinked = await call(page, `${ZALO}/connection`, { branchId, method: "DELETE" });
  expect(unlinked.status, "unlink the stub OA").toBe(204);
}
