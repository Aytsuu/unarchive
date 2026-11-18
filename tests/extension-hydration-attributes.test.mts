import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const { isExtensionHydrationAttribute, stripExtensionHydrationAttributes, stripExtensionHydrationAttributesScript } = await import(new URL("../lib/hydration/extension-attributes.ts", import.meta.url).href)

function element(attrs: Record<string, string>, children: ReturnType<typeof element>[] = []) {
  const store = new Map(Object.entries(attrs))
  const node = {
    attributes: [] as { name: string }[],
    children,
    removeAttribute(name: string) {
      store.delete(name)
      node.attributes = [...store.keys()].map((attr) => ({ name: attr }))
    },
    querySelectorAll(_selector: string) {
      return children.flatMap((child) => [child, ...child.querySelectorAll("*")])
    },
  }
  node.attributes = [...store.keys()].map((attr) => ({ name: attr }))
  return node
}

test("antivirus skin attributes are treated as hydration noise", () => {
  assert.equal(isExtensionHydrationAttribute("bis_skin_checked"), true)
  assert.equal(isExtensionHydrationAttribute("bis_register"), true)
  assert.equal(isExtensionHydrationAttribute("__processed_5bcb3f0f-6a28-4017-8f99-fa86ab6a36be__"), true)
  assert.equal(isExtensionHydrationAttribute("class"), false)
  assert.equal(isExtensionHydrationAttribute("hidden"), false)
})

test("stripping removes injected body and tree attributes and keeps real ones", () => {
  const preview = element({ class: "flex", bis_skin_checked: "1" })
  const body = element({
    class: "min-h-full flex flex-col",
    bis_register: "W3si",
    "__processed_5bcb3f0f-6a28-4017-8f99-fa86ab6a36be__": "true",
  }, [preview])
  stripExtensionHydrationAttributes(body)
  assert.deepEqual(body.attributes.map((attr) => attr.name), ["class"])
  assert.deepEqual(preview.attributes.map((attr) => attr.name), ["class"])
})

test("pre-hydration script watches for injected attributes before React loads", () => {
  assert.match(stripExtensionHydrationAttributesScript, /bis_skin_checked/)
  assert.match(stripExtensionHydrationAttributesScript, /bis_register/)
  assert.match(stripExtensionHydrationAttributesScript, /__processed_/)
  assert.match(stripExtensionHydrationAttributesScript, /MutationObserver/)
})

test("root layout suppresses html and body hydration warnings from injected attributes", async () => {
  const layout = await readFile(fileURLToPath(new URL("../app/layout.tsx", import.meta.url)), "utf8")
  assert.match(layout, /<html[\s\S]*suppressHydrationWarning/)
  assert.match(layout, /<body[\s\S]*suppressHydrationWarning/)
  assert.match(layout, /stripExtensionHydrationAttributesScript/)
})
