import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { isLandingHeaderCompact, isLandingHeaderCompactFromSentinel } from "../lib/landing/header-scroll.ts"

test("the landing header stays expanded only while the page is pinned to the top edge", () => {
  assert.equal(isLandingHeaderCompact(0), false)
  assert.equal(isLandingHeaderCompact(1), true)
  assert.equal(isLandingHeaderCompact(480), true)
  assert.equal(isLandingHeaderCompactFromSentinel(true), false)
  assert.equal(isLandingHeaderCompactFromSentinel(false), true)
})

test("the landing header morphs with a sentinel observer instead of a window scroll listener", async () => {
  const header = await readFile(fileURLToPath(new URL("../components/landing/landing-header.tsx", import.meta.url)), "utf8")
  const page = await readFile(fileURLToPath(new URL("../components/landing/landing-page.tsx", import.meta.url)), "utf8")
  const logo = await readFile(fileURLToPath(new URL("../components/brand/brand-logo.tsx", import.meta.url)), "utf8")
  assert.match(header, /"use client"/)
  assert.match(header, /IntersectionObserver/)
  assert.match(header, /isLandingHeaderCompactFromSentinel/)
  assert.match(header, /rounded-\[100px\]/)
  assert.match(header, /max-w-125/)
  assert.match(header, /max-w-full/)
  assert.match(header, /h-15/)
  assert.match(header, /h-18/)
  assert.match(header, /duration-700/)
  assert.match(header, /ease-\[cubic-bezier\(0\.4,0,0\.2,1\)\]/)
  assert.match(header, /backdrop-blur-xl/)
  assert.match(header, /bg-background\/65/)
  assert.match(header, /prefers-reduced-transparency:reduce/)
  assert.match(header, /motion-reduce:transition-none/)
  assert.match(header, /group-data-\[compact=true\]\/header:max-w-0/)
  assert.doesNotMatch(header, /showWordmark=\{!compact\}/)
  assert.doesNotMatch(header, /addEventListener\(\s*["']scroll["']/)
  assert.match(logo, /wordmarkClassName/)
  assert.match(page, /<LandingHeader account=\{account\}/)
  assert.match(page, /group-data-\[compact=true\]\/header:min-w-26/)
  assert.match(page, /group-data-\[compact=true\]\/header:border-border/)
})
