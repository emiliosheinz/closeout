import { expect, test } from "@playwright/test";
import { STORE } from "./helpers";

test("on a phone the catalog never scrolls sideways and an item's WhatsApp action shows without scrolling", async ({
  page,
}) => {
  await page.goto(STORE);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.goto(`${STORE}?q=bicicleta`);
  await page.getByRole("link", { name: "Bicicleta aro 29" }).click();
  await expect(page.getByTestId("whatsapp-contact").last()).toBeInViewport();
});
