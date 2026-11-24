import { expect, type Page } from "@playwright/test";

export const PASS = "teh tarik at 7";

/** Kuala Lumpur wall-clock time as a Date (KL is UTC+8 all year). */
export const kl = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`);

/** Fails the test on any console error or uncaught exception (catches CSP violations too). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

export async function createPasscode(page: Page, pass = PASS) {
  await page.goto("/");
  await page.getByLabel("Passcode", { exact: true }).fill(pass);
  await page.getByLabel("Type it again").fill(pass);
  await page.getByRole("button", { name: "Lock and continue" }).click();
}

/** Passcode + first-run setup with synthetic names. */
export async function setUp(page: Page) {
  await createPasscode(page);
  await page.getByLabel("Your daughter's name").fill("Test Child");
  await page.getByLabel("Your name").fill("Parent A");
  await page.getByLabel("Another family member (optional)").fill("Parent B");
  await page.getByLabel("Babysitter's name").fill("Sitter One");
  await page.getByRole("button", { name: "Start the diary" }).click();
  await expect(page.locator("[data-status]")).toBeVisible();
}

export async function noHorizontalScroll(page: Page) {
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  expect(r.doc, "page should not scroll sideways").toBeLessThanOrEqual(r.win);
}

export async function unlock(page: Page, pass = PASS) {
  await page.getByLabel("Passcode", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Unlock" }).click();
}

/** For tests that jump the clock forward by hours: stop the (correct) idle auto-lock from kicking in. */
export async function noAutoLock(page: Page) {
  await page.addInitScript(() => localStorage.setItem("ls.lock.minutes", "0"));
}
