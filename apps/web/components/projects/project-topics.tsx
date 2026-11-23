import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

import { topicStyles } from "@/components/projects/topic-icon"

function TopicBadge({ topic }: { topic: string }) {
  return <Badge variant="secondary" className={`h-auto min-h-7 max-w-full whitespace-normal wrap-break-word px-4 py-1 text-sm text-foreground ${topicStyles[topic]?.color ?? "bg-secondary"}`}>{topic}</Badge>
}

export function ProjectTopics({ topics = [] }: { topics?: string[] }) {
  if (!topics.length) return null
  const visible = topics.slice(0, 4)
  const remaining = topics.slice(4)

  return (
    <ul aria-label="Project topics" className="flex min-w-0 flex-wrap items-center gap-2">
      {visible.map((topic, index) => <li key={`${index}-${topic}`} className="max-w-full"><TopicBadge topic={topic} /></li>)}
      {remaining.length > 0 && <li>
        <Popover>
          <PopoverTrigger aria-label={`Show ${remaining.length} more ${remaining.length === 1 ? "topic" : "topics"}`} className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">+{remaining.length}</PopoverTrigger>
          <PopoverContent align="start" className="max-w-[calc(100vw-2rem)] gap-3">
            <PopoverTitle>More topics</PopoverTitle>
            <ul className="flex flex-wrap gap-2">{remaining.map((topic, index) => <li key={`${index}-${topic}`} className="max-w-full"><TopicBadge topic={topic} /></li>)}</ul>
          </PopoverContent>
        </Popover>
      </li>}
    </ul>
  )
}
