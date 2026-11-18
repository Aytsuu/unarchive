import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { PROJECT_TOPICS } from "../lib/project-topics.mjs"
import { topicSlug } from "../lib/projects/topic-slug.mjs"
const { landingAccountLinks, landingExploreHref, landingFooterGroups, landingGetStartedHref, landingPublishHref, landingTopicTiles } = await import(new URL("../lib/landing/links.ts", import.meta.url).href)

test("hero headline and actions match the Figma landing hero", async () => {
  const source = await readFile(fileURLToPath(new URL("../components/landing/landing-page.tsx", import.meta.url)), "utf8")
  assert.match(source, /Research deserves a<br \/>life beyond the archive/)
  assert.doesNotMatch(source, /life beyond the archive\./)
  assert.match(source, /text-\[75px\]/)
  assert.match(source, /leading-\[70px\]/)
  assert.match(source, /tracking-\[-3px\]/)
  assert.match(source, /font-semibold/)
  assert.match(source, /max-w-\[550px\]/)
  assert.match(source, /Explore projects →/)
  assert.match(source, /Publish your work/)
})

test("guests can explore projects without signing in", () => {
  assert.equal(landingExploreHref(), "/home")
})

test("publish always goes through the publish route so guests are sent to login", () => {
  assert.equal(landingPublishHref(), "/publish")
})

test("header shows login and get started for guests and Home when signed in", () => {
  assert.deepEqual(landingAccountLinks(false), [
    { href: "/login", label: "Log in" },
    { href: "/signup", label: "Get Started" },
  ])
  assert.deepEqual(landingAccountLinks(true), [{ href: "/home", label: "Home" }])
})

test("closing get started sends guests to signup and signed-in users to publish", () => {
  assert.equal(landingGetStartedHref(false), "/signup")
  assert.equal(landingGetStartedHref(true), "/publish")
})

test("discipline tiles use home topic names and topic listing routes", () => {
  const tiles = landingTopicTiles()
  assert.deepEqual(tiles.map((tile) => tile.name), [...PROJECT_TOPICS])
  for (const tile of tiles) assert.equal(tile.href, `/topics/${topicSlug(tile.name)}`)
})

test("footer explore and legal links reach public pages", () => {
  const groups = Object.fromEntries(landingFooterGroups().map((group) => [group.title, group.links]))
  assert.deepEqual(groups.Explore, [
    { href: "/home", label: "Projects" },
    { href: "/#topics", label: "Topics" },
    { href: "/home", label: "Institutions" },
  ])
  assert.equal(groups.Create.find((link) => link.label === "Publish a project")?.href, "/publish")
  assert.equal(groups.Legal.find((link) => link.label === "Terms")?.href, "/terms")
  assert.equal(groups.Legal.find((link) => link.label === "Privacy")?.href, "/privacy")
  assert.equal(groups.About, undefined)
})
