# Publish Moderation MCP

## Summary

Add a development-only MCP endpoint that lets agents review pending submissions, approve publication, and request revisions. Reuse the existing moderation services so bot decisions follow the same publication and notification workflow as human decisions. This document is an initial implementation plan.

## Implementation plan

- Mount a Streamable HTTP MCP endpoint at `/api/mcp` in the web app using `mcp-handler`, the compatible MCP TypeScript SDK, and Zod. Return 404 outside development.
- Register three tools:
  - `list_pending_submissions` returns existing review details for up to the oldest 100 pending submissions, including abstracts, topics, contributors, links, and dates.
  - `approve_submission` accepts a submission ID and publishes it through the existing transactional decision service.
  - `request_submission_revision` accepts a submission ID and a nonblank reason of at most 4,000 characters.
- Record decisions under a fixed server-defined bot identity. Return clear MCP tool errors for invalid input, missing submissions, and submissions already decided.
- After approval, invalidate the web app's existing project-list cache. Preserve the existing notification events and publication behavior.
- Document the local endpoint, its tools, the fixed decision identity, and the 100-submission limit in the existing project documentation.

## Initial file structure

```text
apps/web/
  app/api/mcp/route.ts             # Development-only HTTP route and MCP handler
  lib/mcp/publish-moderation.ts    # Tool registration, input schemas, and responses
tests/
  publish-moderation-mcp.test.mts  # Tool and endpoint behavior
```

Keep publication and decision rules in the existing `packages/domain/submissions.mjs` service; the MCP tools call that service rather than duplicating its logic. Use the web app's existing MongoDB and project-list cache helpers.

## Verification

- Verify MCP initialization, tool discovery, full pending-review output, and the empty queue using an MCP client.
- Cover approval and revision requests, including publication, notification events, decision attribution, and cache invalidation.
- Cover malformed IDs, blank or oversized reasons, missing submissions, repeated and concurrent decisions, and service failures.
- Verify that the endpoint returns 404 outside development, and run the relevant existing moderation tests and build checks.

## Assumptions

- The endpoint has no authentication and is available only in development. Anyone able to reach the development server can call its moderation tools, so it must run only in a trusted environment.
- The first version exposes existing review fields; it does not add separate media retrieval, pagination, bot account management, or OAuth.
