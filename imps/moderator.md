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

## Verification

- Test submission, approval, requested changes, resubmission, and review of edits while the previous version remains public.
- Verify the header button appears for permitted moderators and is absent for guests, ordinary users, and revoked moderators. Confirm the button opens the queue without a second login or landing page.
- Verify direct moderator URLs, APIs, and pending media reject unauthenticated users, ordinary users, and revoked moderators. Confirm an unauthenticated page visit uses the existing web login and returns only to a validated destination, and that a permitted moderator can access the queue and operations with the existing session.
- Test simultaneous decisions, retries, stale submissions, failures during promotion, and public cache refresh after approval.
- Verify existing published projects, versions, direct links, and media remain accessible after migration. Run both app builds and relevant unit, integration, and end-to-end tests.

## Assumptions

- All new projects and edits require review.
- Moderators approve or request changes; requested changes can be resubmitted.
- Existing accounts receive moderator roles, with the project owner's account provisioned first.
- Existing public projects remain public without retroactive review.
