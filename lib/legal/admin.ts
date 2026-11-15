export function isLegalAdmin(email: string | undefined, configured = process.env.LEGAL_ADMIN_EMAILS ?? "") {
  if (!email?.trim()) return false
  const allowed = configured.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(email.trim().toLowerCase())
}

export function legalContactEmail() {
  const configured = process.env.LEGAL_CONTACT_EMAIL?.trim()
  if (configured && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)) return configured
  return ""
}
