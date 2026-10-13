// Captures desktop screenshots of the running app (npm run dev on :5173) for the report.
// Uses the locally installed Google Chrome through puppeteer-core.
// NOTE: performs real actions (approve leave, generate + pay October payroll);
// run `npm run setup:db` afterwards to restore the demo data.
import puppeteer from "puppeteer-core";
import dotenv from "dotenv";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });
const OUT = path.join(ROOT, "report", "shots");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5173";
const PASS = process.env.DEMO_PASSWORD;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  userDataDir: path.join(process.env.TEMP || ROOT, `payroll-shots-${Date.now()}`),
  args: ["--no-first-run", "--no-default-browser-check", "--disable-extensions"],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.5 },
});

async function session(email) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "networkidle0" });
  if (email) {
    await page.type('input[type="email"]', email);
    await page.type('input[aria-label="Password"]', PASS);
    await page.click(".auth-submit");
    await page.waitForSelector(".sidebar", { timeout: 15000 });
    await sleep(1500);
  }
  return { ctx, page };
}
const shot = async (page, name) => {
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("saved", name);
};
const clickText = async (page, selector, text) => {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await h.evaluate((el) => el.textContent.trim());
    if (t.startsWith(text)) { await h.click(); return; }
  }
  throw new Error(`no ${selector} with text ${text}`);
};
const openActivity = (page) => clickText(page, ".topbar .btn", "DB activity");
const closeActivity = async (page) => { const x = await page.$(".drawer-head .icon-btn"); if (x) await x.click(); await sleep(300); };
const go = async (page, route) => { await page.goto(BASE + route, { waitUntil: "networkidle0" }); await sleep(1200); };

// 1. login page
{
  const { ctx, page } = await session(null);
  await shot(page, "01_login");
  await ctx.close();
}

// 2. employee: check in + apply for leave
{
  const { ctx, page } = await session("lebron.james@allcaps.example");
  await clickText(page, "button", "Check in");
  await sleep(1500);
  await openActivity(page);
  await shot(page, "02_employee_checkin");
  await go(page, "/leave");
  const selects = await page.$$("form select");
  await selects[0].select("Casual");
  const dates = await page.$$('form input[type="date"]');
  for (const [h, v] of [[dates[0], "2026-10-27"], [dates[1], "2026-10-28"]]) {
    await h.click({ clickCount: 3 });
    await h.evaluate((el, val) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
  }
  await page.type('form input[placeholder="Optional"]', "Cousin's wedding in Akron");
  await clickText(page, "button", "Submit request");
  await sleep(1800);
  await openActivity(page);
  await shot(page, "03_employee_apply_leave");
  await ctx.close();
}

// 3. manager: approve leave
{
  const { ctx, page } = await session("aubrey.graham@allcaps.example");
  await go(page, "/leave");
  await shot(page, "04_manager_approvals");
  // approve Coco Gauff's sick leave (row containing "Coco")
  const rows = await page.$$("tbody tr");
  for (const r of rows) {
    if ((await r.evaluate((el) => el.textContent)).includes("Coco Gauff")) {
      const btns = await r.$$("button");
      for (const b of btns) if ((await b.evaluate((el) => el.textContent)) === "Approve") { await b.click(); break; }
      break;
    }
  }
  await sleep(2000);
  await openActivity(page);
  await shot(page, "05_manager_approved");
  await ctx.close();
}

// 4. payroll officer: generate, payslip, pay, locked delete
{
  const { ctx, page } = await session("jeffery.williams@allcaps.example");
  await go(page, "/payroll");
  const selects = await page.$$(".page-actions select");
  await selects[0].select("10");
  await sleep(1500);
  await clickText(page, "button", "Generate payroll");
  await sleep(4000);
  await openActivity(page);
  await shot(page, "06_payroll_generate");
  await closeActivity(page);
  const first = await page.$("tbody tr");
  await first.click();
  await sleep(2000);
  await shot(page, "07_payslip");
  await page.keyboard.press("Escape");
  await sleep(500);
  await clickText(page, "button", "Pay all");
  await sleep(3500);
  await openActivity(page);
  await shot(page, "08_payroll_paid");
  await closeActivity(page);
  const del = await page.$("tbody tr button");
  await del.click();
  await sleep(2500);
  await openActivity(page);
  await shot(page, "09_paid_locked");
  await ctx.close();
}

// 5. admin: dashboard + queries page
{
  const { ctx, page } = await session("daniel.dumile@allcaps.example");
  await shot(page, "10_admin_dashboard");
  await go(page, "/queries");
  await clickText(page, ".query-item", "Q4");
  await sleep(2500);
  await shot(page, "11_queries");
  await go(page, "/employees");
  await shot(page, "12_employees");
  await ctx.close();
}

await browser.close();
