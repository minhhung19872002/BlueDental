import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A stand-in for the **partner system** a branch syncs its service catalog to.
 * The partner is external to BlueDental and does not exist locally, so the
 * acceptance test runs this one: a real HTTP server the real BlueDental API
 * calls over the wire, speaking BlueDental's partner contract
 * (docs/clone/api.md § Clinic integration). Nothing of BlueDental's own is
 * faked — the browser, the API, the database and the HTTP hop are all real.
 *
 * It remembers every code it has accepted, so a second record with a known
 * code comes back "duplicated" and a resend comes back "updated", as a real
 * partner would. A service named with "[warn]" or "[fail]" is answered with a
 * warning or a refusal, so those paths can be driven on purpose.
 */

export interface SandboxItem {
  externalId: string;
  code: string;
  name: string;
  price: number;
  isDeleted: boolean;
}

export interface PartnerSandbox {
  url: string;
  apiKey: string;
  /** Every batch received, in order. */
  batches: SandboxItem[][];
  handshakes: number;
  /** Pretends the partner already holds `code`, on a record of its own. */
  seedCode: (code: string, name: string) => void;
  close: () => Promise<void>;
}

interface Held {
  externalId: string;
  name: string;
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function isItem(value: unknown): value is SandboxItem {
  if (typeof value !== "object" || value === null) return false;
  const row: Record<string, unknown> = { ...value };
  return typeof row.externalId === "string" && typeof row.code === "string" && typeof row.name === "string";
}

function itemsOf(body: unknown): SandboxItem[] {
  if (typeof body !== "object" || body === null || !("items" in body) || !Array.isArray(body.items)) return [];
  return body.items.filter(isItem).map((item) => ({ ...item }));
}

function answer(held: Map<string, Held>, item: SandboxItem) {
  const known = held.get(item.code);
  const base = { externalId: item.externalId, systemId: `sys-${item.code}` };

  if (item.name.includes("[fail]")) return { ...base, status: "failed", reason: "Đối tác từ chối dịch vụ thử nghiệm" };
  if (known && known.externalId !== item.externalId) {
    return { ...base, status: "duplicated", systemName: known.name };
  }

  held.set(item.code, { externalId: item.externalId, name: item.name });
  if (item.name.includes("[warn]")) return { ...base, status: "warned", reason: "Thiếu đơn vị tính" };
  return { ...base, status: known ? "updated" : "created", relinked: false };
}

export async function startPartnerSandbox(apiKey: string): Promise<PartnerSandbox> {
  const held = new Map<string, Held>();
  const batches: SandboxItem[][] = [];
  let handshakes = 0;

  const server = http.createServer((req, res) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.method !== "POST") return reply(405, { error: "method" });
    if (req.headers["x-api-key"] !== apiKey) return reply(401, { error: "bad key" });

    void readJson(req)
      .then((body) => {
        if (req.url === "/handshake") {
          handshakes += 1;
          return reply(200, { ok: true });
        }
        if (req.url === "/service-catalog/batch") {
          const items = itemsOf(body);
          batches.push(items);
          return reply(200, { results: items.map((item) => answer(held, item)) });
        }
        return reply(404, { error: "not found" });
      })
      .catch(() => reply(400, { error: "bad json" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address: AddressInfo | string | null = server.address();
  if (!address || typeof address === "string") throw new Error("The partner sandbox did not bind a TCP port.");
  const { port } = address;

  return {
    url: `http://127.0.0.1:${port}`,
    apiKey,
    batches,
    get handshakes() {
      return handshakes;
    },
    seedCode: (code, name) => held.set(code, { externalId: `partner-own-${code}`, name }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
