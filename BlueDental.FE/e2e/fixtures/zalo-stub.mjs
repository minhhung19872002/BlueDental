// Local stand-in for Zalo's OAuth / Open API / ZBS endpoints, so a host under
// e2e never reaches the real OA. Usage: node zalo-stub.mjs <port> <oaId>
//
// Point the API host at it with Zalo__OAuthBaseUrl, Zalo__OpenApiBaseUrl and
// Zalo__BusinessApiBaseUrl = http://127.0.0.1:<port>, and pass the OA id the
// branch's connection holds, so the host's OA check matches. GET /__calls
// lists every request it got (specs check nothing was sent).
//
// ZNS refuses every number starting 0399 (84399… as the host may send it), so a
// spec can follow a failed send through to Thống kê CSKH.
//
// POST /__config {"tokenLife":"3600","refreshFails":true} makes the next tokens
// short-lived (inside the host's 2 h refresh leeway, so every use refreshes)
// and refuses a refresh the way Zalo refuses a revoked token; {"reset":true}
// goes back to the defaults. A spec that changes it resets it when done.
import http from "node:http";

const port = Number(process.argv[2] ?? 5199);
const oaId = process.argv[3] ?? "stub-oa";
const calls = [];
const UNDELIVERABLE = /"phone":"(84|0)399/;
const DEFAULTS = { tokenLife: "90000", refreshFails: false };
let config = { ...DEFAULTS };

const PARAMS = {
  "301001": [
    { name: "customer_name", require: true, type: "STRING", maxLength: 30, minLength: 0, acceptNull: false },
    { name: "booking_date", require: true, type: "DATE", maxLength: 20, minLength: 0, acceptNull: false },
    { name: "booking_time", require: true, type: "STRING", maxLength: 20, minLength: 0, acceptNull: false },
    { name: "promo_note", require: true, type: "STRING", maxLength: 100, minLength: 0, acceptNull: false },
    { name: "extra", require: false, type: "STRING", maxLength: 100, minLength: 0, acceptNull: true },
  ],
  "301002": [{ name: "customer_name", require: true, type: "STRING", maxLength: 30, minLength: 0, acceptNull: false }],
  "301003": [{ name: "customer_name", require: true, type: "STRING", maxLength: 30, minLength: 0, acceptNull: false }],
};

const TEMPLATES = [
  { templateId: "301001", templateName: "Nhắc lịch hẹn (stub)", status: "ENABLE", templateQuality: "HIGH" },
  { templateId: "301002", templateName: "Chúc mừng sinh nhật (stub)", status: "PENDING_REVIEW", templateQuality: "UNDEFINED" },
  { templateId: "301003", templateName: "Ưu đãi (stub)", status: "REJECT", templateQuality: "LOW" },
];

function send(res, body) {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      calls.push({ method: req.method, path: url.pathname, query: url.search, body });
      switch (url.pathname) {
        case "/__calls":
          return send(res, calls);
        case "/__config": {
          const change = body ? JSON.parse(body) : {};
          config = change.reset ? { ...DEFAULTS } : { ...config, ...change };
          return send(res, config);
        }
        case "/v4/oa/access_token":
          if (config.refreshFails && body.includes("grant_type=refresh_token"))
            return send(res, { error: -14014, error_name: "Invalid refresh token", error_description: "revoked" });
          return send(res, { access_token: "stub-access", refresh_token: "stub-refresh", expires_in: config.tokenLife });
        case "/v2.0/oa/getoa":
          return send(res, { error: 0, message: "Success", data: { oa_id: oaId, name: "Stub OA" } });
        case "/template/all":
          return send(res, {
            error: 0,
            message: "Success",
            data: TEMPLATES.map((t) => ({ ...t, createdTime: 1760000000000 })),
            metadata: { total: TEMPLATES.length },
          });
        case "/template/info/v2": {
          const id = url.searchParams.get("template_id");
          const template = TEMPLATES.find((t) => t.templateId === id);
          if (!template) return send(res, { error: -1124, message: "Template not found" });
          return send(res, {
            error: 0,
            message: "Success",
            data: { ...template, listParams: PARAMS[id], previewUrl: "", price_sdt: "300", timeout: 7200 },
          });
        }
        case "/message/template":
          if (UNDELIVERABLE.test(body)) return send(res, { error: -108, message: "Phone number is invalid" });
          return send(res, {
            error: 0,
            message: "Success",
            data: { msg_id: `stub-${calls.length}`, sent_time: String(Date.now()), quota: { dailyQuota: "500", remainingQuota: "499" } },
          });
        default:
          res.writeHead(404);
          return res.end();
      }
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`zalo stub on ${port}`));
