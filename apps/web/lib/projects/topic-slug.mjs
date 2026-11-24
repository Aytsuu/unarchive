import { PROJECT_TOPICS } from "../project-topics.mjs"

export function topicSlug(topic) {
  return topic.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export function topicFromSlug(slug) {
  const value = typeof slug === "string" ? slug.trim().toLowerCase() : ""
  return PROJECT_TOPICS.find((topic) => topicSlug(topic) === value) ?? null
}
