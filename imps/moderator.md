# Moderator Interface and Publication Review

## Summary

Use a single monorepo containing two independently deployed Next.js applications backed by the existing MongoDB database and shared server-side domain code:

```text
unarchive/
  apps/
    web/                 # unarchive.com
    moderator/           # moderator.unarchive.com
  packages/
    ui/                  # shared components and styles
    domain/              # project types, validation, and moderation rules
    server/              # database access, authentication, and server-only services
```

Use npm workspaces and the existing lockfile initially. Each app has its own build, deployment, environment configuration, and domain. Share components and code where needed; keep moderator-only screens and privileged operations in the moderator app. Configure Next.js to transpile local workspace packages as needed.

Both applications use the same MongoDB database and project records. The database holds the moderation queue, while shared server-side services enforce the same rules from both applications. A separate backend service or message broker is unnecessary for the initial workload. The moderator app opens directly to the moderation queue; it does not have a separate landing page or authentication UI.

The current publishing flow creates a public project immediately, and edits update the public version immediately. Moderation requires separate submitted snapshots so a moderator approves exactly what the creator submitted while the last approved version remains public.

## Publication and moderation

- When a creator submits a new project or an edit, store an immutable submission snapshot with its owner, submission time, and `pending` status. For edits, retain the current approved version as the public version.
- List pending submissions in the moderator app and provide a detail view of the submitted content and media. Moderators can approve or request changes; requesting changes requires an explanation.
- Approval atomically records the decision and promotes that exact snapshot to the public project and version. Use a conditional transition to prevent simultaneous decisions on the same submission.
- When changes are requested, show the creator the reason and allow revision and resubmission as a new reviewable snapshot. Show submission status and decision history in the creator dashboard.
- Keep existing public projects visible during migration and treat them as previously approved. Subsequent edits enter moderation.
- Audit every public access path, including listings, search, direct project and version URLs, statistics, references, and media routes, so pending content cannot be accessed through a known URL. Restrict pending media to its owner and authorized moderators.
- Handle cache invalidation across deployments explicitly. Approval must cause the public app to refresh affected listings and project pages through an authenticated server-to-server invalidation mechanism.

## Access and deployment

- Moderators are existing web users with an additional server-side moderator permission; ordinary web users do not receive this permission by default. Resolve the permission from the server when rendering the web header, and show a Moderation button only to users who currently have it. The button links directly to the moderator queue.
- Reuse the existing Better Auth login and session across both applications. Configure cross-subdomain session cookies for the web and moderator hosts, with HTTPS, Secure and HttpOnly attributes, appropriate SameSite settings, explicit trusted origins, and CSRF protection for state-changing requests. Sharing a parent-domain cookie exposes it to sibling subdomains, so restrict control of those subdomains and account for that trust boundary in deployment. No separate moderator sign-in or account is created.
- On every moderator page, API, and protected media request, validate the session and check the current moderator permission server-side. Do not rely on the header button, a client-side check, or a role cached in a session as the authorization boundary; revocation must take effect on subsequent requests. Redirect unauthenticated page requests to the existing web login, with a validated return destination; deny authenticated users without permission. APIs and media must deny unauthorized requests without returning protected content.
- Provision the initial moderator's existing account through a controlled administrative bootstrap. Support granting and revoking roles for additional moderators later.
- Keep app-specific production secrets and deployment settings separate. Securely configure any shared Better Auth secret and session settings required to validate the existing session in both deployments. Both deployments need appropriately scoped access to MongoDB and project storage. Configure DNS and HTTPS for each hostname when deploying.
- Keep the existing legal-report administration functional during the split. Moving that workflow into the moderator app can follow separately.

## Development moderation MCP

The web app exposes a Streamable HTTP MCP endpoint at `/api/mcp` while `NODE_ENV` is `development`. On the default local port that is `http://localhost:3000/api/mcp`. The dev stack may bind another port in the 3000–3099 range; use that port with the same path. The endpoint is not authenticated and answers 404 outside development. Anyone who can reach the development server can call it, so run it only in a trusted environment.

Every decision is recorded as `unarchive-moderation-bot`. That identity is fixed in the server. It is stored as the moderator on the submission and as the actor on the notification event. There is no bot account to provision.

- `list_pending_submissions` returns the existing review details for the oldest pending submissions, at most 100. Each item includes the abstract, topics, contributors, links, and dates.
- `get_pending_submission` returns those review details for one submission id, including a pending submission outside that 100-item queue.
- `approve_submission` publishes one pending submission through the shared decision service, then invalidates the web app's project-list cache.
- `request_submission_revision` asks for changes. The reason must be nonblank and at most 4,000 characters.

Malformed ids, blank or oversized reasons, missing submissions, and submissions that already have a decision come back as tool errors. Publication and notification behavior matches a decision made in the moderator app.

## Publication webhook

A new publication submission or revision resubmission in development saves one delivery record in the same transaction as that snapshot. The event id is the new snapshot's submission id, so saving the same request again does not create another notification, and each resubmitted snapshot gets its own event. A failed transaction leaves neither the new snapshot nor a new delivery. A failed HTTP delivery does not undo the submission.

`npm run stack` and `make stack run` start the publication webhook worker and `npm run notifications:work -- --watch` with the web and moderator servers. Those processes are named `publish-webhook` and `notifications` in `.stack/dev-process.json`. `npm run stop` and `make stack stop` stop both workers with the other tracked processes. The worker runs only when `NODE_ENV` is `development`. `npm run webhooks:publish` starts one delivery pass outside the stack. An unset `NODE_ENV` is treated as development; any other value exits without sending.

Set `PUBLISH_WEBHOOK_URL` to an `https://` endpoint and `PUBLISH_WEBHOOK_SECRET` to the bearer secret in `.env.local`. The worker POSTs `{ "type": "submission.created", "submissionId": "<id>" }` with `Authorization: Bearer <secret>`. If either value is missing, or the URL is not HTTPS, due deliveries stay pending and are not sent. Delivery is at least once: the bot treats a repeated notification for the same submission id as the same event.

Inspect status in the `publishWebhookDeliveries` collection. A record is `pending`, `leased`, `delivered`, or `dead`. Failed attempts keep `lastError` and retry with bounded backoff. After eight attempts the record is `dead`. The tunneled `/api/mcp` endpoint stays unauthenticated.

## Verification

- Test submission, approval, requested changes, resubmission, and review of edits while the previous version remains public.
- Verify the header button appears for permitted moderators and is absent for guests, ordinary users, and revoked moderators. Confirm the button opens the queue without a second login or landing page.
- Verify direct moderator URLs, APIs, and pending media reject unauthenticated users, ordinary users, and revoked moderators. Confirm an unauthenticated page visit uses the existing web login and returns only to a validated destination, and that a permitted moderator can access the queue and operations with the existing session.
- Test simultaneous decisions, retries, stale submissions, failures during promotion, and public cache refresh after approval.
- Verify the development moderation MCP lists, looks up one submission, approves, and requests revisions through the shared decision service, and that `/api/mcp` is absent outside development.
- Verify a new development submission and a revision resubmission each store one webhook delivery, a retry of the same snapshot does not add another, and the development worker can report pending, delivered, and dead delivery status.
- Verify existing published projects, versions, direct links, and media remain accessible after migration. Run both app builds and relevant unit, integration, and end-to-end tests.

## Assumptions

- All new projects and edits require review.
- Moderators approve or request changes; requested changes can be resubmitted.
- Existing accounts receive moderator roles, with the project owner's account provisioned first.
- Existing public projects remain public without retroactive review.
