import { execFileSync } from "node:child_process";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { login } from "./auth";
import { BRANCH_ONE, call, type Reply } from "./marketingTicket";

/** Chat nội bộ (F-89) helpers shared by the API and UI specs. */

export const CHAT = "/api/v1/app/chat";

/** The disposable database the host under test writes to (default: local dev DB). */
const DB_NAME = process.env.E2E_DB_NAME ?? "BlueDental";
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? "bluedental-postgres-1";
const PG_USER = process.env.E2E_PG_USER ?? "bluedental";
const MINIO_CONTAINER = process.env.E2E_MINIO_CONTAINER ?? "bluedental-minio-1";
const MINIO_BUCKET = process.env.E2E_MINIO_BUCKET ?? "bluedental";

/** A 1×1 PNG: real magic bytes, so the host's signature check lets it through. */
export const PNG_1PX_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export interface Session {
  context: BrowserContext;
  page: Page;
  userId: string;
}

/** A fresh browser logged in through the real login screen. */
export async function signIn(browser: Browser, credentials: { userName: string; password: string }): Promise<Session> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  const me = await call<{ currentUser: { id: string } }>(page, "GET", "/api/abp/application-configuration");
  return { context, page, userId: me.body.currentUser.id };
}

export interface Upload {
  status: number;
  body: { id?: string; isImage?: boolean; error?: { code?: string } };
}

/** Multipart upload of `base64` bytes as `fileName` — the same request the composer sends. */
export async function uploadFile(
  page: Page,
  conversationId: string,
  fileName: string,
  base64: string,
  type: string,
  branch = BRANCH_ONE,
): Promise<Upload> {
  return page.evaluate(
    async ({ url, fileName, base64, type, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const form = new FormData();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      form.append("file", new Blob([bytes], { type }), fileName);
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: form,
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : {} };
    },
    { url: `${CHAT}/conversations/${conversationId}/attachments`, fileName, base64, type, branch },
  );
}

/** Downloads an attachment and returns its bytes as base64. */
export async function downloadFile(
  page: Page,
  messageId: string,
  attachmentId: string,
  branch = BRANCH_ONE,
): Promise<{ status: number; base64: string; disposition: string | null }> {
  return page.evaluate(
    async ({ url, branch }) => {
      const res = await fetch(url, { credentials: "include", headers: { "X-Clinic-Branch-Id": branch } });
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      return { status: res.status, base64: btoa(binary), disposition: res.headers.get("content-disposition") };
    },
    { url: `${CHAT}/messages/${messageId}/attachments/${attachmentId}`, branch },
  );
}

/** One value straight from PostgreSQL, bypassing the API (encryption-at-rest check). */
export function sqlScalar(sql: string): string {
  return execFileSync("docker", ["exec", PG_CONTAINER, "psql", "-U", PG_USER, "-d", DB_NAME, "-tAc", sql], {
    encoding: "utf8",
  }).trim();
}

/** The raw object MinIO keeps on disk for a blob (small objects sit inline in xl.meta). */
export function minioObject(blobName: string): Buffer {
  return execFileSync(
    "docker",
    ["exec", MINIO_CONTAINER, "cat", `/data/${MINIO_BUCKET}/host/${blobName}/xl.meta`],
    { env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
  );
}

/**
 * Sends and edits share a per-account limit (30 / 30 s) that a full chat run
 * crosses, so a 429 is waited out instead of failing whichever test hit it.
 */
export async function patiently<T>(request: () => Promise<Reply<T>>): Promise<Reply<T>> {
  for (let attempt = 0; ; attempt++) {
    const reply = await request();
    if (reply.status !== 429 || attempt === 20) return reply;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}
