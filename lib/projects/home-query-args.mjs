export function projectListingArgs({ search, page, pageSize, scope }) {
  return { search, page, pageSize, scope }
}

export function projectTopicsArgs(args = {}) {
  return args.scope === undefined ? {} : { scope: args.scope }
}

export function listingShowsInitialSkeleton(ready, query) {
  return !ready || (Boolean(query.isPending) && query.data == null)
}
