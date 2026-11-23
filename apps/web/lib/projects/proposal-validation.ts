export class ProposalValidationError extends Error {}

export function parseProposalMessage(value: unknown): string {
  if (typeof value !== "string") throw new ProposalValidationError("Message must be text.")
  const result = value.trim()
  if (!result || result.length > 10000) throw new ProposalValidationError("Message must be between 1 and 10,000 characters.")
  return result
}

export function parseProposalFiles(files: unknown[]): File[] {
  if (files.length > 5) throw new ProposalValidationError("Upload up to five images, each no larger than 5 MiB.")
  if (files.some((file) => !(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg"].includes(file.type))) {
    throw new ProposalValidationError("Upload up to five PNG or JPEG images, each no larger than 5 MiB.")
  }
  return files as File[]
}