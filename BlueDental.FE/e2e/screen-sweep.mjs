import { chromium } from "@playwright/test";

const BASE = "http://localhost:5173";
const SCREENS = [
  ["Tiếp nhận", "/reception"],
  ["Lịch hẹn", "/calendar"],
  ["Lịch hẹn (danh sách)", "/calendar/list"],
  ["Danh sách bệnh nhân", "/patient"],
  ["Thanh toán", "/billing"],
  ["Vật tư", "/materials"],
  ["Báo cáo", "/report"],
  ["Labo", "/labo"],
  ["CSKH", "/cskh-grouping"],
  ["Danh mục", "/taxonomy"],
  ["Quản trị vận hành", "/operations"],
  ["Công cụ", "/tools"],
  ["Voucher", "/voucher"],
  ["Nhân viên", "/staff"],
  ["Cài đặt phòng khám", "/settings"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/login`);
await page.getByPlaceholder("Tên đăng nhập hoặc email").fill("admin");
await page.getByPlaceholder("Mật khẩu").fill("Admin@123456");
await page.getByRole("button", { name: "Đăng nhập" }).click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

// A patient with real history, so the detail screen is not judged on an empty one.
const patient = await page.evaluate(async () => {
  const r = await fetch("/api/v1/app/patients?maxResultCount=1", { credentials: "include" });
  return (await r.json()).items?.[0]?.id;
});
SCREENS.push(["Chi tiết bệnh nhân", `/patient/${patient}`]);

const problems = [];
for (const [name, route] of SCREENS) {
  const errors = [];
  const onError = (m) => { if (m.type() === "error") errors.push(m.text()); };
  page.on("console", onError);

  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => {
    const main = document.querySelector("main") || document.body;
    const text = main.innerText || "";
    return {
      chars: text.replace(/\s+/g, " ").trim().length,
      unfinished: /đang được phát triển|Coming soon|chưa triển khai/i.test(text),
      crashed: /Đã có lỗi|Something went wrong|Unexpected Application Error/i.test(text),
      heading: (document.querySelector("h1, .page-header-title")?.textContent || "").trim(),
    };
  });

  page.off("console", onError);
  // antd's own deprecation notices are not this app's errors.
  const real = errors.filter((e) => !/\[antd:/.test(e));

  const bad = state.chars < 120 || state.unfinished || state.crashed || real.length > 0;
  if (bad) problems.push({ name, route, ...state, errors: real.slice(0, 2) });

  console.log(
    `${bad ? "BAD " : "ok  "} ${name.padEnd(24)} ${route.padEnd(28)} ${String(state.chars).padStart(5)} chars  ${state.heading.slice(0, 32)}`,
  );
}

await browser.close();
if (problems.length) {
  console.log("\nPROBLEMS:");
  console.log(JSON.stringify(problems, null, 2));
  process.exit(1);
}
console.log("\nall screens render real content");
