import test from "node:test"
import assert from "node:assert/strict"
import { autofillVisibleFields } from "../components/dev-tools/autofill.ts"

test("autofill sends valid month values only to visible, enabled month pickers", async () => {
  class Control extends EventTarget {
    constructor(name, { hidden = false, disabled = false } = {}) { super(); this.name = name; this.hidden = hidden; this.disabled = disabled; this.id = "" }
    closest(selector) { return this.hidden && selector.includes("[hidden]") ? this : null }
    matches(selector) { return this.disabled && selector.includes(":disabled") }
    getClientRects() { return [1] }
    getAttribute(name) { return name === "aria-label" ? this.name : null }
    hasAttribute(name) { return name === "data-dev-month-picker" }
  }
  const start = new Control("Date started")
  const end = new Control("Date ended")
  const hidden = new Control("Hidden date", { hidden: true })
  const disabled = new Control("Disabled date", { disabled: true })
  const fields = [start, end, hidden, disabled]
  const originals = Object.fromEntries(["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "document", "getComputedStyle"].map((name) => [name, globalThis[name]]))
  try {
    globalThis.HTMLInputElement = class {}
    globalThis.HTMLTextAreaElement = class {}
    globalThis.HTMLSelectElement = class {}
    globalThis.document = { querySelectorAll: () => fields, getElementById: () => null }
    globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" })
    const events = []
    for (const field of fields) field.addEventListener("dev-autofill-month", (event) => events.push([field.name, event.detail]))
    const count = await autofillVisibleFields({ fields: { "date started": "2023-08", "date ended": "2024-13", "hidden date": "2024-01", "disabled date": "2024-01" }, images: [] })
    assert.equal(count, 1)
    assert.deepEqual(events, [["Date started", "2023-08"]])
  } finally {
    for (const [name, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[name]
      else globalThis[name] = value
    }
  }
})
