import assert from "node:assert/strict"
import { test } from "node:test"
import { moderationEmailContent } from "../apps/web/lib/notifications/moderation-email.ts"

test("moderation emails link to fixed application routes without exposing revision reasons", () => {
  const id = "507f1f77bcf86cd799439011"
  const revision = moderationEmailContent({ type: "project.revision_requested", submissionId: id, projectId: id }, "https://example.com/base")
  assert.match(revision.text, new RegExp(`https://example.com/submissions/${id}`))
  assert.equal(revision.subject, "Revisions requested for your submission")
  const approved = moderationEmailContent({ type: "project.publish_approved", submissionId: id, projectId: id }, "https://example.com")
  assert.match(approved.text, new RegExp(`https://example.com/projects/${id}`))
  assert.throws(() => moderationEmailContent({ type: "project.revision_requested", submissionId: "../admin", projectId: id }, "https://example.com"))
  assert.throws(() => moderationEmailContent({ type: "project.publish_approved", submissionId: id, projectId: id }, "https://user:pass@example.com"))
})
