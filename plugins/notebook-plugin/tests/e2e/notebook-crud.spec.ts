import { test, expect } from "@playwright/test";

const RUN = process.env.NOTEBOOK_E2E === "1";

test.describe("notebook-plugin CRUD", () => {
  test.skip(!RUN, "set NOTEBOOK_E2E=1 with a running sibyl+trex to run");

  test("create, save, reopen and delete a notebook", async ({ page }) => {
    await page.goto("/plugins/notebook-plugin/");

    await page.getByRole("button", { name: "New notebook" }).click();
    const nameField = page.getByLabel("Name");
    await nameField.fill("E2E Notebook");
    await page.getByRole("button", { name: "Save" }).click();

    // Back to list, the new notebook is listed.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("E2E Notebook")).toBeVisible();

    // Reopen it.
    await page.getByText("E2E Notebook").click();
    await expect(page.getByLabel("Name")).toHaveValue("E2E Notebook");
    await page.getByRole("button", { name: "Back" }).click();

    // Delete it (auto-accept the confirm dialog).
    page.on("dialog", (d) => d.accept());
    await page
      .getByRole("row", { name: /E2E Notebook/ })
      .getByTitle("Delete")
      .click();
    await expect(page.getByText("E2E Notebook")).toHaveCount(0);
  });
});
