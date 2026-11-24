import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createPasscode, kl, noAutoLock, setUp } from "./helpers";

test("backup, erase, restore on a 'new phone' with a different passcode", async ({ page }) => {
  await noAutoLock(page);
  await page.clock.setFixedTime(kl("2026-11-24", "08:10"));
  await setUp(page);
  await page.getByRole("button", { name: "Dropped off", exact: true }).click();
  await page.getByRole("button", { name: "Save drop-off" }).click();
  await page.clock.setFixedTime(kl("2026-11-24", "17:30"));
  await page.getByRole("button", { name: "Picked up", exact: true }).click();
  await page.getByRole("button", { name: "Save pickup" }).click();
  await expect(page.getByText("Time for a backup.")).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Settings" }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toBe("littlesteps-backup-2026-11-24.littlesteps");
  const path = await download.path();
  const content = await readFile(path, "utf8");
  expect(content).not.toContain("Test Child");
  expect(content).not.toContain("Sitter One");

  // CSV export
  const dl2 = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export spreadsheet (CSV)" }).click();
  const csv = await readFile(await (await dl2).path(), "utf8");
  expect(csv).toContain("2026-11-24,visit,08:10,17:30,560,picked up by Parent A,Parent A,Sitter One,");

  // Erase everything
  await page.getByLabel("Type ERASE to confirm").fill("ERASE");
  await page.getByRole("button", { name: "Erase", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your passcode" })).toBeVisible();

  // New passcode, then restore from the onboarding screen
  await createPasscode(page, "new phone passcode");
  await page.getByRole("button", { name: "Restore from backup…" }).click();
  await page.getByLabel("Backup file").setInputFiles(path);
  await page.getByLabel("Passcode for this backup").fill("wrong one");
  await page.getByRole("button", { name: "Open backup" }).click();
  await expect(page.getByText("That passcode doesn't open this backup")).toBeVisible();
  await page.getByLabel("Passcode for this backup").fill("teh tarik at 7");
  await page.getByRole("button", { name: "Open backup" }).click();
  await expect(page.getByText("has 1 visits and 0 entries for Test Child")).toBeVisible();
  await page.getByRole("button", { name: "Replace with backup" }).click();
  const status = page.locator("[data-status]");
  await expect(status).toHaveAttribute("data-status", "out");
  await expect(status).toContainText("8:10 AM to 5:30 PM");

  // The restored diary opens with the NEW passcode
  await page.reload();
  await page.getByLabel("Passcode", { exact: true }).fill("new phone passcode");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(status).toHaveAttribute("data-status", "out");
});

test("a file that isn't a backup is refused", async ({ page }) => {
  await createPasscode(page);
  await page.getByRole("button", { name: "Restore from backup…" }).click();
  await page.getByLabel("Backup file").setInputFiles({ name: "x.littlesteps", mimeType: "application/json", buffer: Buffer.from('{"version":2,"payments":[]}') });
  await page.getByLabel("Passcode for this backup").fill("anything");
  await page.getByRole("button", { name: "Open backup" }).click();
  await expect(page.getByText("That file isn't a LittleSteps backup.")).toBeVisible();
});
