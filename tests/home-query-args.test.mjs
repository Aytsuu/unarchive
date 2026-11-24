import { strict as assert } from "node:assert"
import { test } from "node:test"
import { listingShowsInitialSkeleton, projectListingArgs, projectTopicsArgs } from "../apps/web/lib/projects/home-query-args.mjs"

const source = { search: "flood", page: 2, pageSize: 12, scope: "user-1" }

test("topics args omit listing pagination and search", () => {
  assert.deepEqual(projectListingArgs(source), { search: "flood", page: 2, pageSize: 12, scope: "user-1" })
  assert.deepEqual(projectTopicsArgs(source), { scope: "user-1" })
  assert.ok(!("page" in projectTopicsArgs(source)))
  assert.ok(!("search" in projectTopicsArgs(source)))
  assert.ok(!("pageSize" in projectTopicsArgs(source)))
})

test("listing skeleton is only for the initial query render", () => {
  assert.equal(listingShowsInitialSkeleton(false, { isPending: true, data: undefined }), true)
  assert.equal(listingShowsInitialSkeleton(true, { isPending: true, data: undefined }), true)
  assert.equal(listingShowsInitialSkeleton(true, { isPending: true, data: { projects: [], total: 50, page: 1, pageSize: 12 } }), false)
  assert.equal(listingShowsInitialSkeleton(true, { isPending: false, data: { projects: [], total: 50, page: 2, pageSize: 12 } }), false)
})
