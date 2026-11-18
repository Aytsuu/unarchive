import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

test("the login Google button uses the Figma Google mark", async () => {
  const iconPath = fileURLToPath(new URL("../public/assets/icons/google.svg", import.meta.url))
  const source = await readFile(fileURLToPath(new URL("../components/auth/login-form.tsx", import.meta.url)), "utf8")
  const icon = await readFile(iconPath, "utf8")
  const file = await stat(iconPath)
  assert.ok(file.size > 0)
  assert.match(icon, /width="32"/)
  assert.match(icon, /height="32"/)
  assert.match(source, /\/assets\/icons\/google\.svg/)
  assert.match(source, /Continue with Google/)
  assert.match(source, /width=\{32\}/)
  assert.match(source, /height=\{32\}/)
})

test("the login brand mark links to the landing page like signup", async () => {
  const login = await readFile(fileURLToPath(new URL("../components/auth/login-form.tsx", import.meta.url)), "utf8")
  const signup = await readFile(fileURLToPath(new URL("../components/signup/signup-flow.tsx", import.meta.url)), "utf8")
  assert.match(signup, /<Link href="\/" className="text-xl font-medium leading-10 focus-visible:outline-2 focus-visible:outline-ring"><BrandLogo \/><\/Link>/)
  assert.match(login, /<Link href="\/" className="text-xl font-medium leading-10 focus-visible:outline-2 focus-visible:outline-ring"><BrandLogo \/><\/Link>/)
})
