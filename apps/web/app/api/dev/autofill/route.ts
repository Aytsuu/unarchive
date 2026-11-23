import { isLocalDevelopmentRequest, readAutofillConfig } from "@/lib/dev-autofill"

export async function GET(request: Request) {
  if (!isLocalDevelopmentRequest(request)) return new Response(null, { status: 404 })
  try {
    return Response.json(await readAutofillConfig(), { headers: { "Cache-Control": "no-store" } })
  } catch {
    console.error("Could not read the development autofill configuration")
    return Response.json({ error: "Could not read dev-data/autofill.json or autofill.local.json." }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
