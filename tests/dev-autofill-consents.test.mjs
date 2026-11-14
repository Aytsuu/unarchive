import test from "node:test"
import assert from "node:assert/strict"
import { autofillVisibleFields } from "../components/dev-tools/autofill.ts"

test("autofill checks the two publish consents by label and id", async () => {
  class Control extends EventTarget {
    constructor(id, label) {
      super()
      this.id = id
      this.labels = [{ textContent: label }]
      this.clicked = 0
    }
    closest() { return null }
    matches() { return false }
    getClientRects() { return [1] }
    getAttribute(name) { return name === "role" ? "checkbox" : name === "aria-checked" ? "false" : null }
    hasAttribute() { return false }
    click() { this.clicked += 1 }
  }
  const rights = new Control("publish-rights", "I confirm that I have the necessary rights and permissions to publish this project and its materials.")
  const accuracy = new Control("publish-accuracy", "I confirm that the information is accurate and that I am authorized to publicly share the contributor details provided.")
  const stale = new Control("i-have-permission-to-share-this-project", "I have permission to share this project")
  const originals = Object.fromEntries(["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "document", "getComputedStyle"].map((name) => [name, globalThis[name]]))
  try {
    globalThis.HTMLInputElement = class {}
    globalThis.HTMLTextAreaElement = class {}
    globalThis.HTMLSelectElement = class {}
    globalThis.document = { querySelectorAll: () => [rights, accuracy, stale], getElementById: () => null }
    globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" })
    const count = await autofillVisibleFields({
      fields: {
        "publish-rights": true,
        "publish-accuracy": true,
        "I confirm that I have the necessary rights and permissions to publish this project and its materials.": true,
        "I confirm that the information is accurate and that I am authorized to publicly share the contributor details provided.": true,
      },
      images: [],
    })
    assert.equal(count, 2)
    assert.equal(rights.clicked, 1)
    assert.equal(accuracy.clicked, 1)
    assert.equal(stale.clicked, 0)
  } finally {
    for (const [name, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[name]
      else globalThis[name] = value
    }
  }
})
