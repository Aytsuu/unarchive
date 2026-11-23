import { SignupFlow } from "@/components/signup/signup-flow"
import { SessionCheck } from "@/components/auth/session-check"

export default function SignupPage() {
  return <SessionCheck><SignupFlow /></SessionCheck>
}
