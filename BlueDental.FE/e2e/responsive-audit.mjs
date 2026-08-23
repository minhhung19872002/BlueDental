/**
 * Sweeps every route at several widths and reports anything that makes the
 * document wider than the viewport — the one failure a responsive layout must
 * not have. Run it against a live stack:
 *
 *   node e2e/responsive-audit.mjs [baseURL]
 *
 * It is a diagnostic, not a spec: it prints a report and exits non-zero if any
 * page overflows, so it can gate a change without being part of the suite.
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:5173";
const USER = process.env.E2E_USER ?? "admin";
const PASS = process.env.E2E_PASSWORD ?? "Admin@123456";

const WIDTHS = [1440, 1280, 1024, 820, 600, 414, 360];

const ROUTES = [
  "/dashboard",
  "/reception",
  "/patient",
  "/calendar",
  "/calendar/list",
  "/cskh-grouping",
  "/labo",
  "/billing",
  "/operations",
  "/report",
  "/staff",
  "/materials",
  "/taxonomy",
  "/tools",
  "/voucher",
  "/account/profile",
  "/account/change-password",
];

/** Elements whose right edge sits past the viewport, worst first. */
const PROBE = () => {
  const vw = window.innerWidth;
  const out = [];
  for (const n of document.querySelectorAll("*")) {
    const r = n.getBoundingClientRect();
    if (r.right <= vw + 1 || r.width < 24) continue;
    // An element that scrolls inside its own box is fine; the page is not.
    let scrollsItself = false;
    for (let p = n.parentElement; p; p = p.parentElement) {
      const ov = getComputedStyle(p).overflowX;
      if (ov === "auto" || ov === "scroll" || ov === "hidden") {
        scrollsItself = true;
        break;
      }
    }
    if (scrollsItself) continue;
    out.push({
      sel:
        n.tagName.toLowerCase() +
        (n.className && typeof n.className === "string"
          ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".")
          : ""),
      right: Math.round(r.right),
      width: Math.round(r.width),
    });
  }
  out.sort((a, b) => b.right - a.right);
  return {
    vw,
    docWidth: document.documentElement.scrollWidth,
    offenders: out.slice(0, 4),
  };
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.getByRole("textbox").first().fill(USER);
await page.locator('input[type="password"]').fill(PASS);
await page.getByRole("button", { name: /Đăng nhập|Sign in/ }).click();
await page.waitForURL(/\/(dashboard|reception)/, { timeout: 20000 });

let failures = 0;
for (const route of ROUTES) {
  const bad = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
    const r = await page.evaluate(PROBE);
    if (r.docWidth > r.vw + 1) {
      bad.push(
        `      ${width}px -> doc ${r.docWidth}px  ${r.offenders
          .map((o) => `${o.sel}@${o.right}`)
          .join(", ")}`,
      );
    }
  }
  if (bad.length) {
    failures += bad.length;
    console.log(`  FAIL ${route}`);
    for (const line of bad) console.log(line);
  } else {
    console.log(`  ok   ${route}`);
  }
}

await browser.close();
console.log(failures ? `\n${failures} overflow(s)` : "\nno horizontal overflow at any width");
process.exit(failures ? 1 : 0);
