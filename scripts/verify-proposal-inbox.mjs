import { chromium } from "playwright-core"
import { readFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
  return match ? [[match[1], match[2].trim()]] : []
}))
const email = env.username
const password = env.password
if (!email || !password) throw new Error("username and password are missing from .env.local")

const outDir = resolve("tmp/proposal-verify")
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 951 } })
const failures = []
try {
  await page.goto("http://localhost:3000/login", { waitUntil: "load" })
  await page.locator("#login-email").fill(email)
  await page.locator("#login-password").fill(password)
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await page.waitForURL("**/home", { timeout: 20000 })
  const header = page.locator("header").first()
  const labels = await header.locator("a, button").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label") || node.textContent?.trim() || "").filter(Boolean))
  const search = labels.findIndex((label) => /search/i.test(label))
  const inbox = labels.findIndex((label) => /inbox/i.test(label))
  const saved = labels.findIndex((label) => /saved/i.test(label))
  if (search === -1 || inbox === -1 || saved === -1 || !(search < inbox && inbox < saved)) failures.push(`header order ${JSON.stringify(labels)}`)
  await page.screenshot({ path: resolve(outDir, "home.png"), fullPage: true })

  await header.getByRole("button", { name: "Inbox" }).click()
  await page.getByRole("dialog", { name: "Inbox" }).waitFor()
  await page.screenshot({ path: resolve(outDir, "inbox.png") })
  await page.keyboard.press("Escape")

  const hrefs = await page.getByRole("link", { name: /^Read / }).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")).filter(Boolean))
  let openedProject = false
  for (const href of hrefs.slice(0, 8)) {
    await page.goto(`http://localhost:3000${href}`, { waitUntil: "load" })
    if (!openedProject) {
      const metrics = page.locator("article").locator("div.ml-auto")
      const metricOrder = await metrics.locator("button, span[aria-label]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label") || "").filter(Boolean))
      const saveIndex = metricOrder.findIndex((label) => /save /i.test(label))
      const viewsIndex = metricOrder.findIndex((label) => /\d+ views?$/i.test(label))
      const starsIndex = metricOrder.findIndex((label) => /star/i.test(label))
      if (saveIndex === -1 || viewsIndex === -1 || starsIndex === -1 || !(viewsIndex < starsIndex && starsIndex < saveIndex)) failures.push(`metrics order ${JSON.stringify(metricOrder)}`)
      await page.screenshot({ path: resolve(outDir, "project.png"), fullPage: true })
      openedProject = true
    }
    const propose = page.getByRole("link", { name: "Submit a Proposal" })
    if (await propose.count()) {
      await propose.click()
      await page.waitForURL("**/submit-proposal")
      await page.getByRole("heading", { name: "Submit a Proposal" }).waitFor()
      await page.screenshot({ path: resolve(outDir, "submit-proposal.png"), fullPage: true })
      await page.locator("#proposal-message").fill("I would like to collaborate on this project.")
      await page.getByRole("button", { name: "Submit" }).click()
      await page.waitForURL(/\/projects\/[a-f\d]{24}$/i, { timeout: 20000 })
      await page.getByRole("button", { name: "Inbox" }).click()
      await page.getByRole("dialog", { name: "Inbox" }).waitFor()
      const body = await page.getByRole("dialog").innerText()
      if (!/Projects|Proposals|This project has no proposals yet|collaborate|Unable to load/i.test(body)) failures.push(`inbox after submit: ${body.slice(0, 200)}`)
      await page.screenshot({ path: resolve(outDir, "inbox-after-submit.png") })
      break
    }
  }
  if (!hrefs.length) failures.push("home listing had no project links")
} finally {
  await browser.close()
}
if (failures.length) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else {
  console.log(`verified screenshots in ${outDir}`)
}
