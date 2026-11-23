import test from "node:test"
import assert from "node:assert/strict"
import { TERMS, PRIVACY, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, PUBLISH_CONFIRMATION_TEXT, PUBLISH_CONFIRMATION_TEXT_VERSION } from "../apps/web/lib/legal/policy.ts"

test("terms and privacy documents expose versioned required sections", () => {
  assert.equal(TERMS.type, "terms")
  assert.equal(TERMS.version, CURRENT_TERMS_VERSION)
  assert.equal(TERMS.version, "1.0")
  assert.match(TERMS.effectiveAt, /^\d{4}-\d{2}-\d{2}$/)
  const termsTitles = TERMS.sections.map((section) => section.title)
  for (const title of [
    "Acceptance of Terms",
    "User Accounts",
    "Project Submission Terms",
    "Intellectual Property and Ownership",
    "Academic Attribution",
    "Public Access and Academic Citations",
    "Prohibited Content",
    "Moderation and Removal",
    "Limitation of Responsibility",
    "Contact Information",
  ]) {
    assert.ok(termsTitles.includes(title), `missing terms section: ${title}`)
  }
  assert.equal(PRIVACY.type, "privacy")
  assert.equal(PRIVACY.version, CURRENT_PRIVACY_VERSION)
  assert.equal(PRIVACY.version, "1.0")
  assert.match(PRIVACY.effectiveAt, /^\d{4}-\d{2}-\d{2}$/)
  const privacyTitles = PRIVACY.sections.map((section) => section.title)
  for (const title of [
    "Information Collected",
    "Purposes of Data Processing",
    "Lawful Basis for Processing",
    "Publicly Visible Information",
    "Contributor Information",
    "Third-Party Service Providers",
    "Data Retention",
    "Data Security",
    "User Privacy Rights",
    "Changes to the Privacy Policy",
    "Privacy Contact",
  ]) {
    assert.ok(privacyTitles.includes(title), `missing privacy section: ${title}`)
  }
  for (const document of [TERMS, PRIVACY]) {
    assert.ok(document.sections.every((section) => section.id && section.title && section.paragraphs.length > 0))
  }
})

test("publication confirmation wording is versioned and matches the publish form", () => {
  assert.equal(PUBLISH_CONFIRMATION_TEXT_VERSION, "1.0")
  assert.equal(PUBLISH_CONFIRMATION_TEXT.rights, "I confirm that I have the necessary rights and permissions to publish this project and its materials.")
  assert.equal(PUBLISH_CONFIRMATION_TEXT.accuracy, "I confirm that the information is accurate and that I am authorized to publicly share the contributor details provided.")
})
