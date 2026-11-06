import { test, expect } from "@playwright/test";

test("mobile: inputs produce the cheapest mixed purchase and stale results disappear", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const requests: string[] = [];
  page.on("request", r => requests.push(r.url()));
  await page.goto("./");
  await expect(page.getByText(/表示価格は動作確認用の架空価格/)).toBeVisible();
  await page.getByLabel("サンプルチキンの個数").fill("3");
  await page.getByLabel("サンプルポテトの個数").fill("1");
  await page.getByRole("button", { name: "購入プランを計算" }).click();
  await expect(page.locator(".result .price")).toHaveText("950 円");
  await expect(page.locator(".result")).toContainText("チキン単品（サンプル） × 1");
  await expect(page.locator(".result")).toContainText("固定セット（サンプル） × 1");
  await expect(page.locator(".result")).toContainText("余りはありません。");
  await page.getByLabel("サンプルチキンの個数").fill("4");
  await expect(page.locator(".result .price")).toHaveCount(0);
  await page.getByRole("button", { name: "購入プランを計算" }).click();
  await expect(page.locator(".result .price")).toHaveText("1,100 円");
  await expect(page.locator(".result")).toContainText("サンプルポテト × 1");
  expect(errors).toEqual([]);
  expect(requests.every(url => url.startsWith("http://127.0.0.1:4173/kfc-problem-solver/"))).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("empty input, invalid quantity and repeated calculation", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "購入プランを計算" }).click();
  await expect(page.locator(".result .price")).toHaveText("0 円");
  await expect(page.getByText("購入は不要です。")).toBeVisible();
  await page.getByLabel("サンプルチキンの個数").fill("101");
  await expect(page.getByRole("button", { name: "購入プランを計算" })).toBeDisabled();
  await page.getByLabel("サンプルチキンの個数").fill("1.5");
  await expect(page.getByRole("button", { name: "購入プランを計算" })).toBeDisabled();
  await page.getByLabel("サンプルチキンの個数").fill("2");
  await page.getByRole("button", { name: "購入プランを計算" }).click();
  await expect(page.locator(".result .price")).toHaveText("600 円");
});

test("download failures are recoverable", async ({ page }) => {
  await page.route("**/*.wasm", route => route.abort());
  await page.goto("./");
  await page.getByRole("button", { name: "購入プランを計算" }).click();
  await expect(page.getByRole("alert")).toContainText("読み込めませんでした");
  await page.unroute("**/*.wasm");
  await page.getByRole("button", { name: "購入プランを計算" }).click();
  await expect(page.locator(".result .price")).toHaveText("0 円");
});

for (const action of ["cancel", "edit", "timeout"]) {
  test(`slow WASM: ${action}`, async ({ page }) => {
    // Hold the real Worker at WASM loading so cancellation/deadline is deterministic.
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/*.wasm", async route => { await gate; await route.continue().catch(() => {}); });
    await page.goto("./");
    await page.getByRole("button", { name: "購入プランを計算" }).click();
    await expect(page.getByRole("button", { name: "キャンセル" })).toBeVisible();
    if (action === "timeout") {
      await expect(page.locator(".result")).toContainText("最安値は確定していません", { timeout: 8_000 });
    } else {
      if (action === "cancel") await page.getByRole("button", { name: "キャンセル" }).click();
      else await page.getByLabel("サンプルチキンの個数").fill("1");
      await expect(page.locator(".result")).toContainText("希望個数を入力して計算してください");
    }
    release();
    await expect(page.locator(".result .price")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "購入プランを計算" })).toBeEnabled();
  });
}
