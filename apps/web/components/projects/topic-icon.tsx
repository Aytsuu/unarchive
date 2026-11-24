export const topicStyles: Record<string, { color: string; icon: string; transform?: string }> = {
  "AI & Data Science": { color: "bg-[#ede9fe]", icon: "ai" },
  "Health & Medicine": { color: "bg-[#fce7f3]", icon: "health", transform: "-scale-x-100" },
  "Education & Learning": { color: "bg-[#dbeafe]", icon: "education" },
  "Environment & Sustainability": { color: "bg-[#dcfce7]", icon: "environment" },
  "Smart Cities & IoT": { color: "bg-[#cffafe]", icon: "cities", transform: "-scale-y-100" },
  "Agriculture & Food": { color: "bg-[#fef3c7]", icon: "agriculture" },
  "Business & Finance": { color: "bg-[#ffedd5]", icon: "business" },
  "Public Safety & Governance": { color: "bg-[#fee2e2]", icon: "safety-verified" },
}

export function TopicIcon({ topic, size = 16 }: { topic: string; size?: number }) {
  const style = topicStyles[topic]
  if (!style) return null
  return <span className={`inline-flex shrink-0 items-center justify-center ${style.transform ?? ""}`} style={{ width: size, height: size }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/assets/icons/topics/${style.icon}.svg`} alt="" className="max-h-full max-w-full" />
  </span>
}
