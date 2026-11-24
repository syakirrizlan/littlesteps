import { expect, test } from "@playwright/test";
import { createPasscode, kl, PASS, setUp, unlock, watchErrors } from "./helpers";

test("weak passcodes are refused and a wrong passcode doesn't open the diary", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Passcode", { exact: true }).fill("12345678");
  await expect(page.getByText("Don't use only numbers")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lock and continue" })).toBeDisabled();

  await createPasscode(page);
  await page.getByRole("button", { name: "Start the diary" }).waitFor();
  await page.reload();
  await unlock(page, "not the passcode");
  await expect(page.locator("p[role=alert]")).toContainText("isn't right");
  await expect(page.getByLabel("Your daughter's name")).toHaveCount(0);
});

test("the Lock button hides everything until the passcode is entered", async ({ page }) => {
  await setUp(page);
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("Test Child")).toHaveCount(0);
  await unlock(page);
  await expect(page.locator("[data-status]")).toBeVisible();
});

test("auto-lock after the chosen idle time", async ({ page }) => {
  await page.clock.install({ time: kl("2026-11-24", "09:00") });
  await setUp(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Lock automatically after").selectOption("1");
  await page.clock.runFor(75_000);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("production security headers are sent and nothing breaks under them", async ({ page }) => {
  const errors = watchErrors(page);
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["content-security-policy"]).toContain("connect-src 'self'");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["permissions-policy"]).toContain("geolocation=()");
  await setUp(page);
  expect(errors).toEqual([]);
});

test("the app makes no requests to other websites", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost:4173")) outside.push(r.url());
  });
  await setUp(page);
  await page.getByRole("button", { name: "Dropped off", exact: true }).click();
  await page.getByRole("button", { name: "Save drop-off" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Days" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Settings" }).click();
  expect(outside.filter((u) => !u.startsWith("data:") && !u.startsWith("blob:"))).toEqual([]);
});

test("opens offline once installed", async ({ page, context }) => {
  await setUp(page);
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.reload();
  await unlock(page, PASS);
  await expect(page.locator("[data-status]")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await unlock(page, PASS);
  await expect(page.locator("[data-status]")).toBeVisible();
  await context.setOffline(false);
});
