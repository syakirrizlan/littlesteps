import { expect, test } from "@playwright/test";
import { kl, noAutoLock, noHorizontalScroll, PASS, setUp, unlock, watchErrors } from "./helpers";

const TUE = "2026-11-24";

test("a full day: drop-off, meal, nap, pickup, report, and it survives a reload", async ({ page }) => {
  const errors = watchErrors(page);
  await noAutoLock(page);
  await page.clock.setFixedTime(kl(TUE, "08:12"));
  await setUp(page);

  const status = page.locator("[data-status]");
  await expect(status).toHaveAttribute("data-status", "waiting");
  await expect(status).toContainText("Usual drop-off 8:00 AM");
  await expect(page.getByRole("button", { name: "Picked up", exact: true })).toBeDisabled();

  // Drop-off. The phone is set to New York, but the time shown is Kuala Lumpur time.
  await page.getByRole("button", { name: "Dropped off", exact: true }).click();
  await expect(page.getByLabel("Time time")).toHaveValue("08:12");
  await page.getByRole("button", { name: "Save drop-off" }).click();
  await expect(status).toHaveAttribute("data-status", "in");
  await expect(status).toContainText("Since 8:12 AM");
  await expect(page.getByRole("button", { name: "Dropped off", exact: true })).toBeDisabled();

  // Lunch
  await page.clock.setFixedTime(kl(TUE, "12:05"));
  await page.getByRole("button", { name: "Meal" }).click();
  await page.getByRole("radio", { name: "Lunch" }).check({ force: true });
  await page.getByLabel("Food (optional)").fill("Rice, chicken");
  await page.getByRole("radio", { name: "Ate most" }).check({ force: true });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Lunch · Rice, chicken")).toBeVisible();

  // Nap, then wake up
  await page.clock.setFixedTime(kl(TUE, "12:30"));
  await page.getByRole("button", { name: "Nap" }).click();
  await page.getByLabel("Still asleep").check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Napping since 12:30 PM")).toBeVisible();
  await page.clock.setFixedTime(kl(TUE, "14:00"));
  await page.getByRole("button", { name: "Woke up now" }).click();
  await expect(page.getByText("Nap · 1h 30m")).toBeVisible();

  // Pickup
  await page.clock.setFixedTime(kl(TUE, "17:34"));
  await page.getByRole("button", { name: "Picked up", exact: true }).click();
  await page.getByRole("radio", { name: "Parent B" }).check({ force: true });
  await page.getByRole("button", { name: "Save pickup" }).click();
  await expect(status).toHaveAttribute("data-status", "out");
  await expect(status).toContainText("8:12 AM to 5:34 PM · 9h 22m today");
  await expect(page.getByText("Dropped off by Parent A, picked up by Parent B · Sitter One")).toBeVisible();
  await noHorizontalScroll(page);

  // Nothing readable is stored on the phone
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain("Test Child");
  expect(stored).not.toContain("Rice");

  // Reload: locked, then everything is back
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await unlock(page, PASS);
  await expect(status).toHaveAttribute("data-status", "out");
  await expect(page.getByText("Lunch · Rice, chicken")).toBeVisible();

  // Daily report and month view
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Days" }).click();
  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await expect(page.getByText("9h 22m").first()).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: /Tue, 24 Nov/ }).last().click();
  await expect(page.getByRole("heading", { name: /24 Nov 2026/ })).toBeVisible();
  await page.getByText("Written summary").click();
  await expect(page.getByText("Meals: lunch.")).toBeVisible();
  await noHorizontalScroll(page);

  expect(errors).toEqual([]);
});

test("late drop-off is flagged, and a correction needs a reason and is kept in history", async ({ page }) => {
  await noAutoLock(page);
  await page.clock.setFixedTime(kl(TUE, "08:40"));
  await setUp(page);
  await page.getByRole("button", { name: "Dropped off", exact: true }).click();
  await page.getByRole("button", { name: "Save drop-off" }).click();
  await expect(page.getByText("Late drop-off · 40m after 8:00 AM")).toBeVisible();

  await page.getByRole("button", { name: /8:40 AM/ }).click();
  await page.getByLabel("Drop-off time").fill("08:05");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Add a short reason");
  await page.getByLabel("Reason").fill("Tapped late");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Late drop-off")).toHaveCount(0);
  await expect(page.getByText("Drop-off time: 8:40 AM → 8:05 AM")).toBeVisible();
  await expect(page.getByText("“Tapped late”")).toBeVisible();
});

test("a forgotten pickup shows as needing a correction the next morning", async ({ page }) => {
  await noAutoLock(page);
  await page.clock.setFixedTime(kl(TUE, "08:00"));
  await setUp(page);
  await page.getByRole("button", { name: "Dropped off", exact: true }).click();
  await page.getByRole("button", { name: "Save drop-off" }).click();
  await page.clock.setFixedTime(kl("2026-11-25", "07:30"));
  await page.reload();
  await unlock(page);
  const status = page.locator("[data-status]");
  await expect(status).toHaveAttribute("data-status", "fix");
  await expect(status).toContainText("No pickup recorded for Tue, 24 Nov");
  await page.getByRole("button", { name: "Fix this visit" }).click();
  await page.getByLabel("She has been picked up").check();
  await page.getByLabel("Pickup time").fill("17:30");
  await page.getByLabel("Reason").fill("Forgot to tap pickup");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(status).toHaveAttribute("data-status", "waiting");
});

test("medicine can only be recorded once you have authorised it", async ({ page }) => {
  await noAutoLock(page);
  await page.clock.setFixedTime(kl(TUE, "13:00"));
  await setUp(page);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Medicine" }).click();
  await expect(page.getByText("Only authorised medicine can be recorded")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).last().click();

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Medicine", { exact: true }).fill("Paracetamol syrup");
  await page.getByLabel("Dose", { exact: true }).fill("5 ml");
  await page.getByLabel("When it may be given").fill("If 38 °C or more");
  await page.getByRole("button", { name: "Add instruction" }).click();
  await noHorizontalScroll(page);

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Today" }).click();
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Medicine" }).click();
  await expect(page.getByText("Your instruction: 5 ml, If 38 °C or more")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Paracetamol syrup · 5 ml")).toBeVisible();
});
