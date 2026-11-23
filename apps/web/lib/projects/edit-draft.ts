type ValueField = { value: string }
export type ProjectEditDraft = {
  title: string
  description: string
  abstract: string
  institution: string
  dateStarted: string
  dateEnded: string
  topics: string[]
  links: ValueField[]
  contributors: ValueField[]
  references: { id: string }[]
}

export function prepareProjectEdit(draft: ProjectEditDraft) {
  return {
    title: draft.title.trim(), description: draft.description.trim(), abstract: draft.abstract.trim(),
    institution: draft.institution.trim(), projectType: "thesis" as const,
    dateStarted: draft.dateStarted, dateEnded: draft.dateEnded, topics: [...draft.topics],
    links: draft.links.map((field) => field.value.trim()).filter(Boolean),
    contributors: draft.contributors.map((field) => field.value.trim()).filter(Boolean),
    referenceProjectIds: draft.references.map((reference) => reference.id),
  }
}
