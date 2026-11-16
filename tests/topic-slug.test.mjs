import { strict as assert } from "node:assert"
import { test } from "node:test"
import { PROJECT_TOPICS } from "../lib/project-topics.mjs"
import { topicFromSlug, topicSlug } from "../lib/projects/topic-slug.mjs"

test("maps every project topic to a unique reversible slug", () => {
  const slugs = PROJECT_TOPICS.map((topic) => topicSlug(topic))
  assert.equal(new Set(slugs).size, PROJECT_TOPICS.length)
  for (const topic of PROJECT_TOPICS) assert.equal(topicFromSlug(topicSlug(topic)), topic)
  assert.equal(topicFromSlug("ai-data-science"), "AI & Data Science")
  assert.equal(topicFromSlug("unknown-topic"), null)
})
