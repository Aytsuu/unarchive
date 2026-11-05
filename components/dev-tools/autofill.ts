export type AutofillConfig = {
  fields: Record<string, string | boolean | string[]>
  images: { name: string; type: string; url: string }[]
}

type AutofillControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement

function normalize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function isDisplayed(element: Element) {
  if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false
  const style = getComputedStyle(element)
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0
}

function isAvailable(element: AutofillControl) {
  if (element.closest("[data-dev-autofill], form[role='search']")) return false
  if (element.matches(":disabled, [aria-disabled='true']")) return false
  if (element instanceof HTMLInputElement && ["hidden", "submit", "button", "reset", "search"].includes(element.type)) return false
  if (element instanceof HTMLInputElement && element.type === "file") {
    const label = element.closest("label") || (element.id ? document.querySelector(`label[for=${CSS.escape(element.id)}]`) : null)
    if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false
    return label ? isDisplayed(label) : isDisplayed(element)
  }
  return isDisplayed(element)
}

function controls() {
  return Array.from(document.querySelectorAll<AutofillControl>("main input, main textarea, main select, main [role='checkbox'], main [data-dev-month-picker]"))
    .filter(isAvailable)
}

export function hasAutofillFields() {
  return controls().some((element) => !(element instanceof HTMLInputElement && element.type === "hidden"))
}

function names(element: AutofillControl) {
  const labels = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
    ? Array.from(element.labels ?? []).map((label) => label.textContent ?? "") : []
  const labelled = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "")
  return [element.getAttribute("aria-label") ?? "", ...labelled, ...labels,
    element.getAttribute("name") ?? "", element.id.replace(/^(signup|login)-/, ""), element.getAttribute("placeholder") ?? ""].map(normalize).filter(Boolean)
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value)
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

function isOtp(element: AutofillControl) {
  return element.matches('[autocomplete="one-time-code"], [data-input-otp], #verify-code') || names(element).some((name) => /verification code|one time|otp/.test(name))
}

function fieldValue(element: AutofillControl, fields: Record<string, string | boolean | string[]>) {
  for (const name of names(element)) {
    if (Object.hasOwn(fields, name)) return fields[name]
    const numbered = /^(.*) (\d+)$/.exec(name)
    const arrayValue = numbered ? fields[numbered[1]] : undefined
    if (numbered && Array.isArray(arrayValue)) return arrayValue[Number(numbered[2]) - 1]
  }
  return undefined
}

async function addMissingFields(fields: Record<string, string | boolean | string[]>) {
  for (const [name, value] of Object.entries(fields)) {
    if (!Array.isArray(value) || !value.length) continue
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>("main button"))
      .find((item) => isDisplayed(item) && !item.disabled && normalize(item.textContent ?? "") === `add ${name}`)
    if (!button) continue
    let existing = controls().filter((element) => names(element).some((candidate) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\d+$`).test(candidate))).length
    const target = Math.min(value.length, 50)
    while (existing < target) {
      button.click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const current = controls().filter((element) => names(element).some((candidate) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\d+$`).test(candidate))).length
      if (current <= existing) break
      existing = current
    }
  }
}

async function fillImages(element: HTMLInputElement, images: AutofillConfig["images"]) {
  const scope = element.closest("label")?.parentElement
  const existing = new Set(Array.from(scope?.querySelectorAll("li > span:first-child") ?? []).map((item) => item.textContent?.trim()))
  const accepted = images.filter((image) => !existing.has(image.name) && image.url.startsWith("/api/dev/autofill/image/") && ["image/png", "image/jpeg"].includes(image.type))
  if (!accepted.length) return 0
  const selected = element.multiple ? accepted : accepted.slice(0, 1)
  const files = await Promise.all(selected.map(async (image) => {
    const response = await fetch(image.url, { cache: "no-store" })
    if (!response.ok) throw new Error(`Could not load the local image ${image.name}.`)
    return new File([await response.blob()], image.name, { type: image.type })
  }))
  const transfer = new DataTransfer()
  files.forEach((file) => transfer.items.add(file))
  element.files = transfer.files
  element.dispatchEvent(new Event("change", { bubbles: true }))
  return files.length
}

export async function autofillVisibleFields(config: AutofillConfig) {
  const fields = Object.fromEntries(Object.entries(config.fields).map(([key, value]) => [normalize(key), value]))
  await addMissingFields(fields)
  let filled = 0
  for (const element of controls()) {
    if (isOtp(element)) continue
    if (element instanceof HTMLInputElement && element.type === "file") {
      filled += await fillImages(element, config.images)
      continue
    }
    const value = fieldValue(element, fields)
    if (value === undefined) continue
    if (element.hasAttribute("data-dev-month-picker")) {
      if (typeof value === "string" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
        element.dispatchEvent(new CustomEvent("dev-autofill-month", { detail: value }))
        filled++
      }
    } else if (element.getAttribute("role") === "checkbox") {
      if (typeof value === "boolean" && (element.getAttribute("aria-checked") === "true") !== value) { element.click(); filled++ }
    } else if (element instanceof HTMLInputElement && element.type === "checkbox") {
      if (typeof value === "boolean" && element.checked !== value) { element.click(); filled++ }
    } else if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) && typeof value === "string" && !("readOnly" in element && element.readOnly)) {
      setValue(element, value)
      filled++
    }
  }
  return filled
}
