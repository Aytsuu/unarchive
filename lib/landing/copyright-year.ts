import { cacheLife } from "next/cache"

export async function copyrightYear() {
  "use cache"
  cacheLife("days")
  return new Date().getFullYear()
}
