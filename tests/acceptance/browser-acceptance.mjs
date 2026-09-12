/**
 * Chromium acceptance runner. Profiles and reports stay in explicit temporary directories.
 * API mocks exercise the actual built UI but do not validate model quality or billing.
 * --mode integration bypasses mocks and requires an explicitly provided local fixture stack.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    "output-dir": { type: "string" },
    "dependency-dir": { type: "string" },
    "browser-executable": { type: "string" },
    "runtime-dir": { type: "string" },
    filter: { type: "string" },
    mode: { type: "string", default: "mock" },
    baseline: { type: "boolean", default: false },
    "baseline-assets": { type: "string" },
  },
});
if (!args.url || !args["output-dir"] || !args["dependency-dir"]) {
  throw new Error(
    "Required: --url URL --output-dir DIR --dependency-dir DIR. Optional: --browser-executable PATH --filter REGEXP --mode mock|integration",
  );
}
if (!["mock", "integration"].includes(args.mode))
  throw new Error("mode must be mock or integration");
// Reject malformed filters before opening a browser or contacting a fixture.
const caseFilter = args.filter ? new RegExp(args.filter) : null;
const { chromium, expect } = createRequire(
  path.resolve(args["dependency-dir"], "package.json"),
)("@playwright/test");
const phase = args.baseline ? "baseline" : "current";
const url = args.url;
if (args.mode === "integration") {
  const target = new URL(url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
    throw new Error("Integration acceptance is restricted to a local fixture stack.");
  }
  const response = await fetch(new URL("/api/providers", target));
  if (!response.ok) throw new Error("Fixture preflight /api/providers failed.");
  const configuration = await response.json();
  const expectedProviders = ["anthropic", "deepseek", "openai"];
  const expectedModels = ["stub-error", "stub-model", "stub-truncated"];
  const available = configuration.available;
  if (
    !Array.isArray(available) ||
    JSON.stringify(available.map((provider) => provider.id).sort()) !== JSON.stringify(expectedProviders) ||
    available.some((provider) =>
      !Array.isArray(provider.models) ||
      JSON.stringify([...provider.models].sort()) !== JSON.stringify(expectedModels)
    )
  ) {
    throw new Error("Refusing generation: provider/model configuration is not the acceptance fixture.");
  }
}
const out = path.resolve(args["output-dir"]);
await fs.mkdir(out, { recursive: true });
process.env.TMPDIR = path.resolve(args["runtime-dir"] || path.join(out, "runtime"));
if (Buffer.byteLength(process.env.TMPDIR) > 58) {
  throw new Error("Chromium Unix sockets require a shorter --runtime-dir (at most 58 bytes).");
}
await fs.mkdir(process.env.TMPDIR, { recursive: true });
const browser = await chromium.launch({
  ...(args["browser-executable"]
    ? { executablePath: args["browser-executable"] }
    : {}),
  headless: true,
  args: ["--no-sandbox"],
});
const results = [];
const providers = {
  default: "openai",
  available: [
    {
      id: "openai",
      name: "验收模型桩",
      models: ["acceptance-model", "acceptance-model-2"],
    },
  ],
};
const body =
  "验收第一段：截至 2026 年共完成 35 次练习。\n\n  \n第二段保持空行与原始数字 68。";
const generated =
  "候选正文：已核对的事实数字为 35，所有事实继续由作者确认。\n\n候选第二段。";
function sse(events) {
  return events
    .map(
      ([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
    )
    .join("");
}
function responseFor(path, p = {}) {
  if (path.endsWith("rewrite-paragraph"))
    return { json: { text: "候选段落：35 次练习与 68 个观察。" } };
  let ev = [];
  if (path.includes("/generate"))
    ev = [
      ["titles", { coverTitles: ["验收标题一", "验收标题二"] }],
      ["cards", { cards: ["封面卡片：验收 35 次", "方法卡片：每日记录"] }],
      ["caption", { caption: generated }],
      [
        "tags",
        {
          tagGroups: [{ type: "broad", label: "主题", tags: ["验收", "写作"] }],
        },
      ],
    ];
  else {
    const targets = p.regenerate
      ? [p.regenerate]
      : path.includes("wechat")
        ? ["title", "digest", "body"]
        : ["title", "body", "tags"];
    ev = targets.map((t) => [
      t,
      t === "tags"
        ? {
            tags: ["验收", "真实事实", "内容写作", "方法", "记录", "长期"],
            imageKeywords: ["笔记", "书桌"],
          }
        : {
            [t]:
              t === "body"
                ? generated
                : t === "digest"
                  ? "验收摘要，事实仍需人工核对。"
                  : "验收新标题：长期练习的三个收获",
          },
    ]);
  }
  return {
    contentType: "text/event-stream",
    body: sse([
      ["step", { step: "extracting" }],
      ...ev,
      ["step", { step: "done" }],
    ]),
  };
}
async function setup(flow = "composer", options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    permissions: ["clipboard-read", "clipboard-write"],
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const state = { mode: "normal", delay: 0, requests: [] };
  if (args.mode === "integration") {
    await context.route("**/api/**", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        const payload = request.postDataJSON();
        if (
          new URL(request.url()).origin !== new URL(url).origin ||
          payload?.provider !== "openai" ||
          payload?.model !== "stub-model"
        ) {
          errors.push("Blocked non-fixture generation request.");
          return route.abort("blockedbyclient");
        }
      }
      return route.continue();
    });
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/") &&
        request.method() === "POST"
      ) {
        state.requests.push({
          path: new URL(request.url()).pathname,
          payload: request.postDataJSON(),
        });
      }
    });
  }
  if (args["baseline-assets"])
    await context.route("**/*", async (route) => {
      const requestURL = new URL(route.request().url());
      const pathname = requestURL.pathname;
      if (
        pathname.startsWith("/api/") ||
        requestURL.origin !== new URL(url).origin
      )
        return route.fallback();
      const name = pathname === "/" ? "/index.html" : pathname;
      const contentType = name.endsWith(".js")
        ? "application/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : name.endsWith(".html")
            ? "text/html"
            : "application/octet-stream";
      await route.fulfill({
        contentType,
        body: await fs.readFile(args["baseline-assets"] + name),
      });
    });
  if (args.mode === "mock")
    await context.route("**/api/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (path.endsWith("providers"))
        return route.fulfill(
          options.offline
            ? { status: 503, json: { error: "offline acceptance" } }
            : { json: providers },
        );
      const payload = req.postDataJSON() || {};
      state.requests.push({ path, payload });
      if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
      if (state.mode === "abort") return route.abort("failed").catch(() => {});
      if (state.mode === "truncated")
        return route
          .fulfill({
            contentType: "text/event-stream",
            body: sse([
              ["step", { step: "body" }],
              ["body", { body: "断流中间值不应写入" }],
            ]),
          })
          .catch(() => {});
      return route.fulfill(responseFor(path, payload)).catch(() => {});
    });
  await context.addInitScript(
    ({ flow, blocked }) => {
      if (blocked) {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("blocked for acceptance", "SecurityError");
          },
        });
        return;
      }
      if (!sessionStorage.getItem("acceptance-initialized")) {
        localStorage.setItem("opera-view", flow);
        sessionStorage.setItem("acceptance-initialized", "1");
      }
    },
    { flow, blocked: options.blocked },
  );
  await page.goto(url);
  if (!options.blocked)
    await page.getByRole("button", { name: "新建稿件" }).waitFor();
  return { page, context, state, errors };
}
async function manual(page, text = body) {
  await page.getByRole("button", { name: "不调用模型，直接写作" }).click();
  await page
    .getByPlaceholder("直接修改正文；无需模型在线。自动保存会保留你的输入。")
    .fill(text);
}
const editor = (page) =>
  page.getByPlaceholder("直接修改正文；无需模型在线。自动保存会保留你的输入。");
async function config(page, flow) {
  const topic = page.locator("textarea").first();
  await topic.fill(
    flow === "adapter"
      ? "这是用于验收的长文。".repeat(30)
      : "关于长期练习写作方法的完整验收选题",
  );
  if (flow === "composer")
    await page.getByRole("button", { name: "知识干货" }).click();
  if (flow === "wechat")
    await page.getByRole("button", { name: "观点洞察" }).click();
  await page.getByRole("button", { name: "知识分享" }).click();
  await page.getByRole("button", { name: /^标准/ }).click();
}
async function save(page) {
  await page.getByRole("button", { name: "保存版本", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存到本机" }),
  ).toBeVisible();
}
async function snapshot(page, flow) {
  return page.evaluate((flow) => {
    const id = localStorage.getItem("opera-active-draft-" + flow);
    return { id, record: JSON.parse(localStorage.getItem(id)) };
  }, flow);
}
async function drawer(page) {
  await page.getByRole("button", { name: "账号菜单", exact: true }).click();
  await page.getByRole("button", { name: "我的草稿箱", exact: true }).click();
}
async function run(name, fn) {
  if (caseFilter && !caseFilter.test(name)) return;
  let env;
  try {
    env = await fn();
    results.push({
      name,
      status: "PASS",
      ...(env?.details ? { details: env.details } : {}),
    });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, status: "FAIL", error: String(error) });
    console.log("FAIL", name, String(error));
  } finally {
    await fs.writeFile(out + "/results.json", JSON.stringify(results, null, 2));
  }
}
async function defect(name, fn) {
  await run(name, async () => {
    const e = await setup(
      "composer",
      name.includes("storage-getter") ? { blocked: true } : {},
    );
    try {
      const actual = await fn(e);
      await e.page.screenshot({
        path: out + "/" + name + ".png",
        fullPage: true,
        animations: "disabled",
      });
      await fs.writeFile(
        out + "/" + name + ".json",
        JSON.stringify({ actual, errors: e.errors }, null, 2),
      );
      return { details: actual };
    } finally {
      await e.context.close();
    }
  });
}
if (args.mode === "mock") {
  await run("B06-dark-button-contrast", async () => {
    const e = await setup("composer");
    const { page } = e;
    try {
      await manual(page);
      await config(page, "composer");
      const contrast = async (locator) => locator.evaluate((element) => {
        const style = getComputedStyle(element);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        const rgb = (color) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const luminance = (color) => rgb(color).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const fg = luminance(style.color), bg = luminance(style.backgroundColor);
        return { foreground: style.color, background: style.backgroundColor, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) };
      });
      const observations = [];
      for (const theme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme: theme });
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        const backup = await contrast(page.getByRole("button", { name: "导出稿件备份", exact: true }));
        expect(backup.ratio).toBeGreaterThanOrEqual(4.5);
        observations.push({ theme, control: "backup", ...backup });
      }
      await page.getByRole("button", { name: "生成正文候选", exact: true }).click();
      const apply = page.getByRole("button", { name: "应用并留存版本", exact: true });
      await apply.waitFor();
      const applyColors = await contrast(apply);
      expect(applyColors.ratio).toBeGreaterThanOrEqual(4.5);
      observations.push({ theme: "dark", control: "apply", ...applyColors });
      await page.getByRole("button", { name: "放弃候选", exact: true }).click();
      await page.getByRole("button", { name: "段落改写", exact: true }).click();
      const rewrite = page.getByRole("button", { name: "AI 改写候选", exact: true }).first();
      const rewriteColors = await contrast(rewrite);
      expect(rewriteColors.ratio).toBeGreaterThanOrEqual(4.5);
      observations.push({ theme: "dark", control: "paragraph", ...rewriteColors });
      await page.setViewportSize({ width: 390, height: 1080 });
      await page.screenshot({ path: out + "/dark-button-contrast.png", fullPage: true, animations: "disabled" });
      return { details: observations };
    } finally { await e.context.close(); }
  });
  await defect("B01-storage-getter", async ({ page, errors }) => {
    await page.waitForTimeout(300);
    const actual = {
      rootText: await page.locator("#root").innerText(),
      errors,
    };
    if (phase !== "baseline") expect(actual.rootText.length).toBeGreaterThan(0);
    else expect(actual.rootText).toBe("");
    return actual;
  });
  await defect("B02-paragraph-other-field-stale", async ({ page }) => {
    await manual(page);
    await page.getByLabel("标题", { exact: true }).fill("原始标题");
    await save(page);
    await page.getByRole("button", { name: "段落改写", exact: true }).click();
    await page
      .getByRole("button", { name: "AI 改写候选", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "更简洁 · AI", exact: true })
      .first()
      .click();
    await page.getByLabel("AI 候选 · 可先调整再应用").waitFor();
    await page
      .getByLabel("标题", { exact: true })
      .fill("修改了关键事实的新标题");
    const enabled = await page
      .getByRole("button", { name: "应用候选", exact: true })
      .isEnabled();
    expect(enabled).toBe(phase === "baseline");
    return { applyEnabledAfterTitleChange: enabled };
  });
  await defect("B03-tags-ime", async ({ page }) => {
    await manual(page);
    const input = page.getByPlaceholder("+ 添加标签");
    await input.fill("中文组合");
    await input.evaluate((e) => {
      e.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true, data: "中" }),
      );
      e.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          isComposing: true,
        }),
      );
    });
    const actual = {
      inputValue: await input.inputValue(),
      committed: await page
        .getByRole("button", { name: "删除标签 中文组合" })
        .count(),
    };
    expect(actual.committed).toBe(phase === "baseline" ? 1 : 0);
    return actual;
  });
  await defect("B04-clipboard-false", async ({ page }) => {
    await manual(page);
    await page.getByLabel("标题", { exact: true }).fill("复制失败应反馈");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
        configurable: true,
      });
      document.execCommand = () => false;
    });
    await page
      .getByRole("button", { name: "复制", exact: true })
      .nth(1)
      .click();
    const actual = {
      copied: await page
        .getByRole("button", { name: "已复制", exact: true })
        .count(),
      text: (await page.locator("body").innerText()).slice(-500),
    };
    expect(actual.copied).toBe(phase === "baseline" ? 1 : 0);
    return actual;
  });
  await defect("B05-paragraph-checkpoint-failure", async ({ page }) => {
    await manual(page);
    await save(page);
    await page.getByRole("button", { name: "段落改写", exact: true }).click();
    await page
      .getByRole("button", { name: "AI 改写候选", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "更简洁 · AI", exact: true })
      .first()
      .click();
    await page.getByLabel("AI 候选 · 可先调整再应用").waitFor();
    await page.evaluate(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException("quota acceptance", "QuotaExceededError");
      };
    });
    await page.locator("textarea").first().fill("尚未保存的下一次生成选题");
    await page.getByRole("button", { name: "应用候选", exact: true }).click();
    const alerts = await page.getByRole("alert").allTextContents();
    await page.getByRole("button", { name: "全文编辑", exact: true }).click();
    const actual = { body: await editor(page).inputValue(), alerts };
    expect(actual.body.includes("候选段落")).toBe(phase === "baseline");
    return actual;
  });
  if (!args.baseline) {
    for (const flow of ["composer", "wechat", "adapter"]) {
      await run("M05-paragraph-accept-discard-stale-" + flow, async () => {
        const e = await setup(flow);
        const { page, state } = e;
        try {
          await manual(page);
          await config(page, flow);
          if (flow === "adapter") {
            await page
              .getByRole("button", { name: "开始改写", exact: true })
              .click();
            await page
              .getByRole("button", { name: "应用并留存版本", exact: true })
              .click();
            await editor(page).fill(body);
          }
          await save(page);
          await page
            .getByRole("button", { name: "段落改写", exact: true })
            .click();
          await page
            .getByRole("button", { name: "AI 改写候选", exact: true })
            .first()
            .click();
          const request = page
            .getByRole("button", { name: "更简洁 · AI", exact: true })
            .first();
          await request.click();
          await page
            .getByRole("button", { name: "放弃候选", exact: true })
            .click();
          await page
            .getByRole("button", { name: "全文编辑", exact: true })
            .click();
          await expect(editor(page)).toHaveValue(body);
          await page
            .getByRole("button", { name: "段落改写", exact: true })
            .click();
          await page
            .getByRole("button", { name: "AI 改写候选", exact: true })
            .first()
            .click();
          await request.click();
          await page
            .getByLabel("AI 候选 · 可先调整再应用")
            .fill("人工调整后的候选数字 35");
          await page
            .getByRole("button", { name: "应用候选", exact: true })
            .click();
          await page
            .getByRole("button", { name: "全文编辑", exact: true })
            .click();
          await expect(editor(page)).toHaveValue(
            "人工调整后的候选数字 35\n\n  \n第二段保持空行与原始数字 68。",
          );
          await save(page);
          const s = await snapshot(page, flow);
          expect(
            s.record.versions.some(
              (v) => (v.value.result.body || v.value.result.caption) === body,
            ),
          ).toBe(true);
          await page
            .getByRole("button", { name: "段落改写", exact: true })
            .click();
          await page
            .getByRole("button", { name: "AI 改写候选", exact: true })
            .first()
            .click();
          state.delay = 600;
          await request.click();
          await page
            .getByRole("button", { name: "编辑原文", exact: true })
            .nth(1)
            .click();
          await page
            .getByLabel("直接编辑原文 · 不调用模型")
            .fill("相邻段落更新事实");
          await page
            .getByRole("button", { name: "保存修改", exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: "应用候选", exact: true }),
          ).toBeDisabled();
          await page
            .getByRole("button", { name: "放弃候选", exact: true })
            .click();
          state.delay = 0;
          await request.click();
          await page.getByLabel("AI 候选 · 可先调整再应用").waitFor();
          if (flow === "composer") {
            await page.getByPlaceholder("+ 添加标签").fill("新事实标签");
            await page.getByPlaceholder("+ 添加标签").press("Enter");
          } else if (flow === "wechat") {
            await page
              .getByLabel("摘要", { exact: true })
              .fill("摘要发生事实变化");
          } else {
            await page
              .getByRole("button", { name: "编辑卡片", exact: true })
              .first()
              .click();
            await page.getByLabel("编辑第 1 张卡片").fill("卡片事实变化");
          }
          await expect(
            page.getByRole("button", { name: "应用候选", exact: true }),
          ).toBeDisabled();
          await page.screenshot({
            path: out + "/paragraph-stale-" + flow + ".png",
            fullPage: true,
            animations: "disabled",
          });
          return {
            details: {
              requests: state.requests.filter((r) =>
                r.path.endsWith("rewrite-paragraph"),
              ).length,
            },
          };
        } finally {
          await e.context.close();
        }
      });
      await run("M07-switch-page-aborts-" + flow, async () => {
        const e = await setup(flow);
        const { page, state } = e;
        try {
          await manual(page);
          await config(page, flow);
          await save(page);
          state.delay = 1300;
          const generate =
            flow === "adapter"
              ? page.getByRole("button", { name: "开始改写", exact: true })
              : page.getByRole("button", { name: "生成正文候选", exact: true });
          await generate.click();
          await page
            .getByRole("button", {
              name: flow === "wechat" ? "写小红书" : "写公众号",
              exact: false,
            })
            .first()
            .click();
          await page.waitForTimeout(1450);
          await page
            .getByRole("button", {
              name:
                flow === "wechat"
                  ? "写公众号"
                  : flow === "adapter"
                    ? "改写成小红书"
                    : "写小红书",
              exact: false,
            })
            .first()
            .click();
          await expect(editor(page)).toHaveValue(body);
          await expect(
            page.getByRole("button", { name: "应用并留存版本", exact: true }),
          ).toHaveCount(0);
        } finally {
          await e.context.close();
        }
      });
      await run("M13-output-matrix-" + flow, async () => {
        const e = await setup(flow);
        const { page } = e;
        const matrix = [];
        try {
          await config(page, flow);
          const generate = page.getByRole("button", {
            name:
              flow === "adapter"
                ? "开始改写"
                : flow === "wechat"
                  ? "生成公众号草稿"
                  : /生成原创帖子/,
          });
          await generate.click();
          await page
            .getByRole("button", { name: "应用并留存版本", exact: true })
            .click();
          for (const width of [390, 860, 1440, 1920])
            for (const theme of ["light", "dark"]) {
              await page.setViewportSize({ width, height: 1080 });
              await page.emulateMedia({ colorScheme: theme });
              await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
              if (width <= 860)
                await page
                  .getByRole("button", { name: "✦ 结果", exact: true })
                  .click();
              await expect(editor(page)).toBeVisible();
              const measured = await page.evaluate(() => ({
                viewport: innerWidth,
                scroll: document.documentElement.scrollWidth,
                theme: document.documentElement.dataset.theme,
              }));
              expect(measured.scroll).toBeLessThanOrEqual(width + 1);
              const bound = await editor(page).boundingBox();
              expect(bound.x).toBeGreaterThanOrEqual(0);
              expect(bound.x + bound.width).toBeLessThanOrEqual(width + 1);
              // Capture the page from its origin, without a partially scrolled sticky header.
              await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
              await page.screenshot({
                path:
                  out + "/output-" + flow + "-" + width + "-" + theme + ".png",
                fullPage: true,
                animations: "disabled",
              });
              matrix.push(measured);
            }
          return { details: { matrix } };
        } finally {
          await e.context.close();
        }
      });
    }
    for (const flow of ["composer", "wechat", "adapter"]) {
      await run("M01-M02-M03-M04-" + flow, async () => {
        const e = await setup(flow);
        const { page } = e;
        try {
          await manual(page, flow + " A " + body);
          await page
            .locator("textarea")
            .first()
            .fill(flow + " A 未完成手写稿");
          await page.reload();
          await expect(editor(page)).toHaveValue(flow + " A " + body);
          const a = await snapshot(page, flow);
          await page
            .getByRole("button", { name: "新建稿件", exact: true })
            .click();
          await manual(page, flow + " B " + body);
          await page
            .locator("textarea")
            .first()
            .fill(flow + " B 未完成手写稿");
          await save(page);
          const b = await snapshot(page, flow);
          expect(a.id).not.toBe(b.id);
          await drawer(page);
          await page
            .getByRole("dialog", { name: "我的草稿箱" })
            .locator("li")
            .filter({ hasText: flow + " A" })
            .getByRole("button", { name: "恢复", exact: true })
            .click();
          await expect(editor(page)).toHaveValue(flow + " A " + body);
          await drawer(page);
          await page
            .getByRole("dialog", { name: "我的草稿箱" })
            .locator("li")
            .filter({ hasText: flow + " B" })
            .getByRole("button", { name: "恢复", exact: true })
            .click();
          await expect(editor(page)).toHaveValue(flow + " B " + body);
          await page.getByRole("button", { name: /^详细/ }).click();
          await page.getByRole("button", { name: "朋友推荐" }).click();
          await page
            .locator("select")
            .nth(1)
            .selectOption("acceptance-model-2");
          await expect(editor(page)).toHaveValue(flow + " B " + body);
          await page
            .getByRole("button", { name: "段落改写", exact: true })
            .click();
          await page
            .getByRole("button", { name: "编辑原文", exact: true })
            .first()
            .click();
          await page
            .getByLabel("直接编辑原文 · 不调用模型")
            .fill("手工修改第一段");
          await page
            .getByRole("button", { name: "保存修改", exact: true })
            .click();
          await page
            .getByRole("button", { name: "全文编辑", exact: true })
            .click();
          await expect(editor(page)).toHaveValue(
            "手工修改第一段\n\n  \n第二段保持空行与原始数字 68。",
          );
          if (flow !== "adapter") {
            await page
              .getByLabel("标题", { exact: true })
              .fill("超长标题".repeat(50));
            await expect(page.getByLabel("标题", { exact: true })).toHaveValue(
              "超长标题".repeat(50),
            );
            if (flow === "wechat") {
              await page
                .getByLabel("摘要", { exact: true })
                .fill("摘要不应截断".repeat(100));
              await expect(
                page.getByLabel("摘要", { exact: true }),
              ).toHaveValue("摘要不应截断".repeat(100));
            }
          }
          await page.unroute("**/api/providers");
          await page
            .context()
            .route("**/api/providers", (r) =>
              r.fulfill({ status: 503, json: { error: "offline" } }),
            );
          await page.reload();
          await expect(editor(page)).toHaveValue(
            "手工修改第一段\n\n  \n第二段保持空行与原始数字 68。",
          );
          await editor(page).fill("离线继续写作");
          await page.reload();
          await expect(editor(page)).toHaveValue("离线继续写作");
          expect(e.errors).toEqual([]);
          return { details: { draftA: a.id, draftB: b.id } };
        } finally {
          await e.context.close();
        }
      });
      await run("M05-M06-M07-M08-M09-" + flow, async () => {
        const e = await setup(flow);
        const { page, state } = e;
        try {
          await manual(page);
          await config(page, flow);
          await save(page);
          const generate =
            flow === "adapter"
              ? page
                  .getByRole("button", { name: /^(开始改写|重新改写)$/ })
                  .first()
              : page.getByRole("button", { name: "生成正文候选", exact: true });
          await generate.click();
          await page
            .getByRole("button", { name: "放弃候选", exact: true })
            .click();
          await expect(editor(page)).toHaveValue(body);
          await generate.click();
          await page
            .getByRole("button", { name: "应用并留存版本", exact: true })
            .click();
          await expect(editor(page)).toHaveValue(generated);
          await save(page);
          let s = await snapshot(page, flow);
          expect(
            s.record.versions.some(
              (v) => (v.value.result?.body || v.value.result?.caption) === body,
            ),
          ).toBe(true);
          state.delay = 650;
          await generate.click();
          await editor(page).fill("生成期间的新事实 777");
          await expect(
            page.getByRole("button", { name: "应用并留存版本", exact: true }),
          ).toBeDisabled();
          await page
            .getByRole("button", { name: "放弃候选", exact: true })
            .click();
          await expect(editor(page)).toHaveValue("生成期间的新事实 777");
          state.delay = 800;
          await generate.click();
          await page
            .getByRole("button", { name: "取消生成（保留原稿）", exact: true })
            .click();
          await page.waitForTimeout(900);
          await expect(editor(page)).toHaveValue("生成期间的新事实 777");
          await expect(
            page.getByRole("button", { name: "应用并留存版本", exact: true }),
          ).toHaveCount(0);
          state.delay = 0;
          state.mode = "truncated";
          await generate.click();
          await expect(
            page.getByText(/生成连接在完成前意外中断/),
          ).toBeVisible();
          await expect(editor(page)).toHaveValue("生成期间的新事实 777");
          await expect(
            page.getByRole("button", { name: "应用并留存版本", exact: true }),
          ).toHaveCount(0);
          state.mode = "normal";
          if (flow !== "adapter") {
            const target = flow === "wechat" ? "摘要" : "标签";
            await page.getByTitle("重新生成" + target, { exact: true }).click();
            await page
              .getByRole("button", { name: "应用并留存版本", exact: true })
              .click();
            expect(state.requests.at(-1).payload.currentContent.body).toBe(
              "生成期间的新事实 777",
            );
            await expect(editor(page)).toHaveValue("生成期间的新事实 777");
          }
          const before = await page
            .locator("section")
            .filter({ hasText: "交付前基础检查" })
            .last()
            .innerText()
            .catch(() => "");
          await page.getByRole("button", { name: /^详细/ }).click();
          await expect(editor(page)).toHaveValue("生成期间的新事实 777");
          const after = await page
            .locator("section")
            .filter({ hasText: "交付前基础检查" })
            .last()
            .innerText()
            .catch(() => "");
          expect(after).toBe(before);
          const key = (await snapshot(page, flow)).record.value
            .resultParameterKey;
          await page.screenshot({
            path: out + "/generation-" + flow + ".png",
            fullPage: true,
            animations: "disabled",
          });
          return {
            details: {
              requests: state.requests,
              resultParameterKey: key,
              checklist: before,
            },
          };
        } finally {
          await e.context.close();
        }
      });
    }
    await run("M10-version-roundtrip", async () => {
      const e = await setup();
      const { page } = e;
      try {
        await manual(page, "历史正文 A");
        await save(page);
        const first = (await snapshot(page, "composer")).record.versions.at(
          -1,
        ).id;
        await editor(page).fill("历史正文 B");
        await save(page);
        await page.locator("select").nth(1).selectOption("acceptance-model-2");
        const count = (await snapshot(page, "composer")).record.versions.length;
        await page
          .getByRole("button", { name: "版本记录", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "稿件版本" })
          .locator("li")
          .filter({ hasText: "手动保存版本" })
          .last()
          .getByRole("button", { name: "恢复此版" })
          .click();
        await expect(editor(page)).toHaveValue("历史正文 A");
        await expect(page.locator("select").nth(1)).toHaveValue(
          "acceptance-model-2",
        );
        await page
          .getByRole("button", { name: "版本记录", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "稿件版本" })
          .locator("li")
          .filter({ hasText: "恢复前的稿件" })
          .first()
          .getByRole("button", { name: "恢复此版" })
          .click();
        await expect(editor(page)).toHaveValue("历史正文 B");
        await save(page);
        const latest = await snapshot(page, "composer");
        expect(latest.record.versions.length).toBeGreaterThanOrEqual(count);
        return {
          details: {
            originalVersionId: first,
            versions: latest.record.versions.length,
          },
        };
      } finally {
        await e.context.close();
      }
    });
    await run("M11-storage-quota-navigation-backup", async () => {
      const e = await setup();
      const { page } = e;
      try {
        await manual(page);
        await save(page);
        await page.evaluate(() => {
          Storage.prototype.setItem = function () {
            throw new DOMException("quota acceptance", "QuotaExceededError");
          };
        });
        await editor(page).fill("配额失败保留内存 123");
        await page
          .getByRole("button", { name: "保存版本", exact: true })
          .click();
        await expect(page.getByRole("alert").first()).toBeVisible();
        let message = "";
        page.once("dialog", async (d) => {
          message = d.message();
          await d.dismiss();
        });
        await page
          .getByRole("button", { name: "新建稿件", exact: true })
          .click();
        await expect(editor(page)).toHaveValue("配额失败保留内存 123");
        expect(message).toContain("保存失败");
        const download = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "导出稿件备份", exact: true })
          .click();
        const file = await download;
        await file.saveAs(out + "/quota-backup.json");
        const data = JSON.parse(
          await fs.readFile(out + "/quota-backup.json", "utf8"),
        );
        expect(data.value.result.body).toBe("配额失败保留内存 123");
        page.once("dialog", (d) => d.accept());
        await page
          .getByRole("button", { name: "新建稿件", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "不调用模型，直接写作" }),
        ).toBeVisible();
        return { details: { backup: data.kind, confirmation: message } };
      } finally {
        await e.context.close();
      }
    });
    for (const action of ["modify", "delete"])
      await run("M11-external-" + action, async () => {
        const e = await setup();
        const { page, context } = e;
        try {
          await manual(page);
          await save(page);
          const current = await snapshot(page, "composer");
          const other = await context.newPage();
          await other.goto(url);
          await other.evaluate(
            ({ id, action }) => {
              if (action === "delete") localStorage.removeItem(id);
              else {
                const r = JSON.parse(localStorage.getItem(id));
                r.revision += 10;
                r.value.result.body = "外部窗口正文";
                localStorage.setItem(id, JSON.stringify(r));
              }
            },
            { id: current.id, action },
          );
          await other.close();
          await page.bringToFront();
          await editor(page).fill("本窗口未保存变更");
          await page
            .getByRole("button", { name: "保存版本", exact: true })
            .click();
          await expect(page.getByRole("alert").first()).toBeVisible();
          await expect(editor(page)).toHaveValue("本窗口未保存变更");
          page.once("dialog", (d) => d.dismiss());
          await page
            .getByRole("button", { name: "新建稿件", exact: true })
            .click();
          await expect(editor(page)).toHaveValue("本窗口未保存变更");
          return {
            details: {
              alert: await page.getByRole("alert").first().innerText(),
            },
          };
        } finally {
          await e.context.close();
        }
      });
    await run("M12-delete-confirm-failure-and-clear", async () => {
      const e = await setup();
      const { page } = e;
      try {
        await manual(page);
        await page.locator("textarea").first().fill("删除测试 A");
        await save(page);
        const a = await snapshot(page, "composer");
        await page
          .getByRole("button", { name: "新建稿件", exact: true })
          .click();
        await manual(page);
        await page.locator("textarea").first().fill("保留测试 B");
        await save(page);
        await page.evaluate(() => {
          localStorage.setItem(
            "opera-prefs",
            JSON.stringify({ theme: "dark" }),
          );
          localStorage.setItem("opera-activity-acceptance", "keep");
        });
        await drawer(page);
        const row = page
          .getByRole("dialog", { name: "我的草稿箱" })
          .locator("li")
          .filter({ hasText: "删除测试 A" });
        page.once("dialog", (d) => d.dismiss());
        await row.getByRole("button", { name: "删除", exact: true }).click();
        await expect(row).toBeVisible();
        await page.evaluate(() => {
          window.acceptanceRemove = Storage.prototype.removeItem;
          Storage.prototype.removeItem = function () {
            throw new DOMException("delete denied", "SecurityError");
          };
        });
        page.once("dialog", (d) => d.accept());
        await row.getByRole("button", { name: "删除", exact: true }).click();
        await expect(row).toBeVisible();
        await expect(page.getByText("删除失败，原稿未改动")).toBeVisible();
        await page.evaluate(
          () => (Storage.prototype.removeItem = window.acceptanceRemove),
        );
        page.once("dialog", (d) => d.accept());
        await row.getByRole("button", { name: "删除", exact: true }).click();
        await expect(row).toHaveCount(0);
        expect(
          await page.evaluate((id) => localStorage.getItem(id), a.id),
        ).toBeNull();
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: "账号菜单", exact: true })
          .click();
        await page
          .getByRole("button", { name: "偏好设置", exact: true })
          .click();
        await page
          .getByRole("button", { name: "清空所有本地草稿", exact: true })
          .click();
        await page
          .getByRole("button", { name: "确认清空", exact: true })
          .click();
        const state = await page.evaluate(() => ({
          drafts: Object.keys(localStorage).filter((k) =>
            k.startsWith("opera-draft-"),
          ),
          prefs: localStorage.getItem("opera-prefs"),
          activity: localStorage.getItem("opera-activity-acceptance"),
        }));
        expect(state.drafts).toEqual([]);
        expect(state.prefs).toBeTruthy();
        expect(state.activity).toBe("keep");
        return { details: state };
      } finally {
        await e.context.close();
      }
    });
    await run("M13-layout-theme-keyboard-matrix", async () => {
      const e = await setup();
      const { page } = e;
      const matrix = [];
      try {
        await manual(page);
        await page.getByLabel("标题", { exact: true }).fill("多尺寸验收标题");
        for (const width of [390, 860, 1440, 1920])
          for (const theme of ["light", "dark"]) {
            await page.setViewportSize({ width, height: 1080 });
            await page.emulateMedia({ colorScheme: theme });
            await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
            await page.waitForTimeout(200);
            const sizes = await page.evaluate(() => ({
              viewport: innerWidth,
              scroll: document.documentElement.scrollWidth,
              theme: document.documentElement.dataset.theme,
            }));
            expect(sizes.scroll).toBeLessThanOrEqual(width + 1);
            expect(sizes.theme).toBe(theme);
            await page
              .getByRole("button", { name: "新建稿件", exact: true })
              .scrollIntoViewIfNeeded();
            const bounds = await page
              .getByRole("button", { name: "新建稿件", exact: true })
              .boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            await page.screenshot({
              path: out + "/matrix-" + width + "-" + theme + ".png",
              fullPage: true,
              animations: "disabled",
            });
            matrix.push(sizes);
          }
        await page
          .getByRole("button", { name: "版本记录", exact: true })
          .click();
        const modal = page.getByRole("dialog", { name: "稿件版本" });
        await expect(modal).toBeVisible();
        await page.keyboard.press("Tab");
        expect(
          await modal.evaluate((el) => el.contains(document.activeElement)),
        ).toBe(true);
        await page.keyboard.press("Escape");
        await expect(modal).not.toBeVisible();
        await drawer(page);
        const drafts = page.getByRole("dialog", { name: "我的草稿箱" });
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press("Tab");
          expect(
            await drafts.evaluate((el) => el.contains(document.activeElement)),
          ).toBe(true);
        }
        await page.keyboard.press("Escape");
        await expect(drafts).toHaveCount(0);
        return {
          details: {
            matrix,
            ime: "composition events injected; native OS IME not exercised",
          },
        };
      } finally {
        await e.context.close();
      }
    });
    await run("M14-copy-json-image-reselection", async () => {
      const e = await setup();
      const { page } = e;
      try {
        await manual(page);
        await page.getByLabel("标题", { exact: true }).fill("复制全文验收");
        await page
          .getByRole("button", { name: "复制", exact: true })
          .first()
          .click();
        const clip = await page.evaluate(() => navigator.clipboard.readText());
        expect(clip).toContain("截至 2026 年共完成 35 次练习");
        expect(clip).toContain("第二段保持空行与原始数字 68");
        expect(clip).toContain("复制全文验收");
        const downloaded = page.waitForEvent("download");
        await page.getByRole("button", { name: "导出稿件备份" }).click();
        await (await downloaded).saveAs(out + "/normal-backup.json");
        const backup = JSON.parse(
          await fs.readFile(out + "/normal-backup.json", "utf8"),
        );
        expect(backup.value.result.body).toBe(body);
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7WQAAAAASUVORK5CYII=",
          "base64",
        );
        await page
          .locator("input[type=file]")
          .setInputFiles({
            name: "acceptance.png",
            mimeType: "image/png",
            buffer: png,
          });
        await expect(
          page.getByText("acceptance.png", { exact: true }),
        ).toBeVisible();
        await page.reload();
        await expect(
          page.getByText("acceptance.png", { exact: true }),
        ).toHaveCount(0);
        await page
          .locator("input[type=file]")
          .setInputFiles({
            name: "acceptance.png",
            mimeType: "image/png",
            buffer: png,
          });
        await expect(
          page.getByText("acceptance.png", { exact: true }),
        ).toBeVisible();
        return {
          details: { clipboardChars: clip.length, jsonKind: backup.kind },
        };
      } finally {
        await e.context.close();
      }
    });
    await run("M14-card-select-export", async () => {
      const e = await setup("adapter");
      const { page } = e;
      try {
        await manual(page);
        await config(page, "adapter");
        await page
          .getByRole("button", { name: "开始改写", exact: true })
          .click();
        await page
          .getByRole("button", { name: "应用并留存版本", exact: true })
          .click();
        await page
          .getByRole("button", { name: "选择卡片 1", exact: true })
          .click();
        await page.getByRole("button", { name: /^导出图片/ }).click();
        const download = page.waitForEvent("download");
        await page.getByRole("menuitem", { name: /导出选中/ }).click();
        await (await download).saveAs(out + "/selected-card.png");
        const bytes = await fs.readFile(out + "/selected-card.png");
        expect(bytes.subarray(1, 4).toString()).toBe("PNG");
        return { details: { pngBytes: bytes.length } };
      } finally {
        await e.context.close();
      }
    });
    await run("M15-convert-preserves-both-existing-drafts", async () => {
      const e = await setup("adapter");
      const { page } = e;
      try {
        await manual(page, "已有改写稿应保留");
        await save(page);
        const a = await snapshot(page, "adapter");
        await page.getByRole("button", { name: "写公众号" }).click();
        await manual(page, "公众号事实正文 123");
        await page.getByLabel("标题", { exact: true }).fill("待转换公众号");
        await save(page);
        const w = await snapshot(page, "wechat");
        await page
          .getByRole("button", { name: "转为小红书新稿", exact: true })
          .click();
        await expect(page.locator("textarea").first()).toHaveValue(
          "待转换公众号\n\n公众号事实正文 123",
        );
        await save(page);
        const next = await snapshot(page, "adapter");
        expect(next.id).not.toBe(a.id);
        const values = await page.evaluate(
          ({ a, w }) => [
            JSON.parse(localStorage.getItem(a)).value.result.caption,
            JSON.parse(localStorage.getItem(w)).value.result.body,
          ],
          { a: a.id, w: w.id },
        );
        expect(values).toEqual(["已有改写稿应保留", "公众号事实正文 123"]);
        return {
          details: { previousAdapter: a.id, wechat: w.id, newAdapter: next.id },
        };
      } finally {
        await e.context.close();
      }
    });
  }
}
if (args.mode === "integration") {
  for (const flow of ["composer", "wechat", "adapter"]) {
    await run("integration-generation-delivery-" + flow, async () => {
      const e = await setup(flow);
      const { page, state } = e;
      try {
        await config(page, flow);
        await page.locator("select").nth(0).selectOption("openai");
        await page.locator("select").nth(1).selectOption("stub-model");
        const generate = page.getByRole("button", {
          name:
            flow === "adapter"
              ? "开始改写"
              : flow === "wechat"
                ? "生成公众号草稿"
                : /生成原创帖子/,
        });
        await generate.click();
        if (flow === "adapter") {
          await page
            .getByRole("button", { name: /确认.*继续|继续.*生成/ })
            .click();
        }
        const apply = page.getByRole("button", {
          name: "应用并留存版本",
          exact: true,
        });
        await expect(apply).toBeVisible({ timeout: 45000 });
        expect(await editor(page).count()).toBe(0);
        await page.screenshot({
          path: out + "/integration-candidate-" + flow + ".png",
          fullPage: true,
          animations: "disabled",
        });
        await apply.click();
        const content = await editor(page).inputValue();
        const expectedContent = flow === "adapter"
          ? "这是文章转换后的发布正文。"
          : "这是通过真实 HTTP 传输的第一段正文。\n\n这是通过第二个流式事件传输的正文。";
        expect(content).toBe(expectedContent);
        await save(page);
        const record = await snapshot(page, flow);
        expect(record.record.value.resultStatus).toBe("complete");
        expect(state.requests.length).toBeGreaterThan(0);
        expect(state.requests.every((request) => request.payload.model === "stub-model" && request.payload.provider === "openai")).toBe(true);
        await page.getByRole("button", { name: flow === "adapter" ? "复制全部" : "复制", exact: true }).first().click();
        const clipboard = await page.evaluate(() => navigator.clipboard.readText());
        for (const paragraph of expectedContent.split("\n\n")) expect(clipboard).toContain(paragraph);
        const backupDownload = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "导出稿件备份", exact: true })
          .click();
        const backupPath = out + "/integration-" + flow + ".json";
        await (await backupDownload).saveAs(backupPath);
        const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
        expect(backup.value.result.body || backup.value.result.caption).toBe(
          content,
        );
        if (flow === "adapter") {
          await page
            .getByRole("button", { name: "选择卡片 1", exact: true })
            .click();
          await page.getByRole("button", { name: /^导出图片/ }).click();
          const imageDownload = page.waitForEvent("download");
          await page.getByRole("menuitem", { name: /导出选中/ }).click();
          const imagePath = out + "/integration-card.png";
          await (await imageDownload).saveAs(imagePath);
          const bytes = await fs.readFile(imagePath);
          expect(bytes.subarray(1, 4).toString()).toBe("PNG");
          expect(bytes.readUInt32BE(16)).toBe(1080);
          expect(bytes.readUInt32BE(20)).toBe(1440);
        }
        await page.reload();
        await expect(editor(page)).toHaveValue(content);
        expect(e.errors).toEqual([]);
        await page.screenshot({
          path: out + "/integration-restored-" + flow + ".png",
          fullPage: true,
          animations: "disabled",
        });
        return {
          details: {
            draftId: record.id,
            chars: content.length,
            requests: state.requests,
          },
        };
      } finally {
        await e.context.close();
      }
    });
  }
}
await browser.close();
await fs.writeFile(out + "/results.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.length === 0) {
  console.error("No acceptance cases matched; check --mode and --filter.");
  process.exitCode = 1;
} else if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
