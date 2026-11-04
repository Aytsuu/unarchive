import "server-only"
import { Resend } from "resend"

type Message = { to: string; subject: string; text: string }

export async function sendEmail({ to, subject, text }: Message): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) throw new Error("Email delivery is not configured")

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({ from, to, subject, text })
  if (error) throw new Error("Email delivery failed")
}
