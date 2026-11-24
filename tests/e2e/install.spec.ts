import { expect, test } from "@playwright/test";
import { setUp } from "./helpers";

test("Install app is visible on the first screen and explains how for this phone", async ({ page }, info) => {
  await page.goto("/");
  const install = page.getByRole("button", { name: "Install app" });
  await expect(install).toBeVisible();
  await install.click();
  const dialog = page.getByRole("dialog");
  if (info.project.name === "iphone") {
    await expect(dialog).toContainText("Add to your iPhone Home Screen");
    await expect(dialog).toContainText("Add to Home Screen");
  } else {
    await expect(dialog).toContainText("Install on your Android phone");
    await expect(dialog).toContainText("Install app");
  }
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(dialog).toHaveCount(0);
});

test("uses the browser's own install prompt when it offers one", async ({ page }) => {
  await page.goto("/");
  // Simulate Chrome announcing that the app can be installed.
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    (window as unknown as { __prompted: number }).__prompted = 0;
    e.prompt = async () => {
      (window as unknown as { __prompted: number }).__prompted++;
    };
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  await page.getByRole("button", { name: "Install app" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Install app stays in the header after setup, and in Settings", async ({ page }) => {
  await setUp(page);
  await expect(page.getByRole("banner").getByRole("button", { name: "Install app" })).toBeVisible();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Install LittleSteps" })).toBeVisible();
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  expect(r.doc).toBeLessThanOrEqual(r.win);
});

test("hidden once running as the installed app", async ({ page }) => {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes("display-mode: standalone") ? ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList) : real(q));
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create your passcode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install app" })).toHaveCount(0);
});
