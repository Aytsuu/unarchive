import { isLocalDevelopmentRequest, readAutofillImage } from "@/lib/dev-autofill"

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!isLocalDevelopmentRequest(request)) return new Response(null, { status: 404 })
  try {
    const image = await readAutofillImage((await params).name)
    if (!image) return new Response(null, { status: 404 })
    return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": image.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  } catch {
    console.error("Could not read a development autofill image")
    return new Response(null, { status: 500 })
  }
}
