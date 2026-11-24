# Notifications implementation plan

## Capability and scope

Signed-in users can see relevant activity in an in-app notification inbox, manage optional notification email in settings, and eventually opt in to browser push. The initial activity types are references to and stars received on a user's project, selected account security events, optional product announcements, and justified essential service notices. A dedicated `/whats-new` page references `CHANGELOG.md` and indicates when eligible new content has been published since the user last viewed it. All notifications pertaining to saved projects are excluded.

The existing bell in `components/home/notifications-popover.tsx` is a static placeholder. `app/settings/page.tsx` is the settings entry point. The app uses MongoDB, Better Auth, and Resend; it does not currently have a notification worker. Existing verification emails are part of authentication and remain separate from notification preferences.

## Product rules and decisions

| Topic | Initial behavior |
| --- | --- |
| In-app | Enabled for supported activity; show All and Unread, unread count, mark read, and mark all read. |
| Email | Reference and project-star emails are off by default, as are optional discovery, engagement, and What's New/release emails. Essential account-security notices cannot be disabled. Justified essential service notices may bypass product-marketing preferences. Decide explicitly whether each future important project category defaults on; do not invent another category to fill that policy. |
| Push | Later phase. Off by default; request browser permission only after an explicit Enable action in settings. Permission and subscriptions are browser/device-specific. |
| References | Notify the referenced project's owner when a different user's published project newly references it. The product can observe in-product references, not external citations or copied citation text. |
| Project stars | Notify a project's owner in-app when another user stars the project. Do not notify on self-stars, repeated requests that leave the star unchanged, or star removals. Treat email as optional engagement and default it off. |
| Security | Successful password changes and completed password resets create in-app notifications and essential email. Email changes notify the old and new addresses as appropriate; account suspensions or security restrictions generate email when appropriate. New-device/unusual-sign-in alerts are deferred; failed sign-ins remain security logs only. |
| What's New | Curated entries appear at `/whats-new` and reference `CHANGELOG.md`. A new indicator requires publication after account creation and the user's last acknowledged view. Routine releases do not automatically become notifications; optional product announcement notifications link to `/whats-new`. |
| Essential service notices | Security, privacy, or significant service changes may justify an in-app notice and email regardless of product-marketing preferences; use a distinct, controlled classification. |
| Action Required | Keep the existing tab visible and selectable with its empty state. No notification types are linked to it until an actionable type and its lifecycle are defined. |

In-app history expires after 90 days, whether read or unread; explain this in the UI. Routine email digests are weekly and opt-in. Retain successful delivery metadata for 90 days and failed or dead-letter metadata for 180 days, subject to privacy and operational requirements. Retain outbox records only as long as needed for operations and audit, and never delete unprocessed or retryable work. Remove address snapshots as soon as they are no longer needed for delivery and investigation.

## Architecture and contracts

1. **Record facts at the domain boundary.** Extend `lib/projects/versions.ts` to write versioned reference events into an outbox in the same MongoDB transaction as publication or revision. Use stable event identifiers derived from the committed domain operation, and unique indexes. On initial publish emit events for valid references; on revision compare previous and new reference IDs and emit only newly added references. Do not emit on legacy baseline creation, failed/conflicting transactions, or idempotent replays. Extend the star mutation in `lib/projects/metrics.ts` so a newly created star and its outbox event commit in the same transaction; its current insert/delete path is not transactional. No event is emitted for an existing star, a removal, failed writes, or retries. Use a stable event ID per committed star creation. Do not emit saved-project notification events.
2. **Process outside the request.** Run a separately deployed, continuously operating worker alongside the production application, using the same MongoDB deployment and a least-privilege identity. Atomically claim outbox records with a lease, process in bounded batches, renew or expire leases, retry transient failures with backoff, and surface exhausted jobs for investigation/replay. Track fan-out progress with a stable cursor/checkpoint for large projects. Expose health and queue-age metrics and stop accepting work gracefully during deployment. If hosting only supports scheduled jobs, use durable leases and accept the resulting delay. The local Mongo replica set supports transactions; production must also support them. Name the hosting environment and operational owner before enabling production email.
3. **Resolve recipients and create inbox records idempotently.** Reference recipients come from the referenced project's owner; star recipients come from the starred project's owner. Recheck current content access before delivery. Use unique event/recipient keys (and channel-specific delivery keys), and store minimal payloads with typed event data, timestamps, read state, and safe internal targets. Suppress self-reference and self-star notices.
4. **Group routine activity.** Group references and stars separately by recipient and owned project within a 24-hour window. Record constituent event IDs so retries cannot inflate counts. Count a given starring user at most once per project per window, even if they remove and re-add a star; this prevents toggle spam. Treat the count as people who starred during the window, not the current star total. A new distinct event added to a read group marks it unread again and updates its activity timestamp; a suppressed re-star does neither. A removal does not itself generate or retract an already created historical notification. Offer a weekly opt-in digest for opted-in project references, project stars, and optional product announcements, scheduled Monday at 9:00 a.m. in the user's saved time zone or UTC if none is set. Recheck both digest and category preferences at send time; skip empty digests. Do not delay essential security or service notices for a digest.
5. **Deliver email asynchronously.** Create separate delivery jobs for eligible recipients and categories, then recheck applicable preferences, address eligibility, account state, and linked-content access immediately before sending through `lib/email.ts`/Resend. Essential security and justified service notices follow their distinct policies. Preserve appropriate old and new address destinations for email-change alerts securely, rather than resolving both to the current address. Persist delivery state and attempt metadata without sensitive content. Use a stable Resend idempotency key for retries within its documented 24-hour window and maintain durable local delivery state. After an ambiguous result, later retries outside that window may require operator review to avoid duplicate mail; do not promise exactly-once delivery.
6. **Authorize every read and action.** Derive recipient identity from the session, never from client-supplied user IDs. Filter all queries and mutations by recipient; validate cursors and payloads, rate-limit endpoints, use no-store responses, and apply the project's origin/CSRF protections to writes. Recheck current access to targets when listing and opening; omit or redact unavailable project details and use safe generic content in email/push. Suppress self-events and protect against spoofed links and content.

Security events need a separate integration investigation: Better Auth owns its writes, and its existing after-hook is not evidence of a transactional outbox. Verify the appropriate successful-operation hooks, database lifecycle hooks, and callbacks against the installed version; in particular, capture completed password resets from the post-reset callback, not the reset request. Document each event's authoritative source, commit boundary, deduplication key, and recovery path. If atomic capture is unavailable, design reconciliation or document the resulting guarantee before enabling the event. Persist security events independently of email delivery, retry failures and alert operators on repeated failure. A successful security operation must remain successful if alert delivery fails; never present queued or provider-accepted mail as delivered.

For each selected security event, integration tests must prove its success boundary. Prefer persisting the event atomically with the operation where the integration demonstrably supports it. Otherwise require a verified post-operation capture mechanism and durable recovery or reconciliation, documenting any residual failure window; do not enable the event without a credible capture and recovery path. Better Auth's `onPasswordReset` runs after the password is saved and can return an error after the change if the callback throws; database after-hooks run after transaction commit, so neither alone proves atomic outbox capture. See [Better Auth password reset](https://better-auth.com/docs/authentication/email-password) and [database hooks](https://better-auth.com/docs/concepts/database).

Password-change and completed-reset alerts go to the verified account address and the in-app inbox. For email changes, require confirmation at the current address and verification at the new address, then alert the previous address and send a confirmation/security notice to the new verified address after completion. The old-address alert includes a safe recovery/support path and reveals no more of the new address than necessary. Alert on a suspension or security restriction when it takes effect, unless doing so would undermine an active abuse investigation. Failed sign-ins remain security logs only; new-device and unusual-sign-in alerts are deferred. The current `lib/auth-config.ts` disables email-OTP reset and email-change endpoints and does not configure the standard reset-email callback; build and verify the relevant account flows deliberately before enabling their alerts.

## Data and interface outline

- `notificationEvents` / outbox: stable event ID, type and schema version, subject/actor IDs, occurred time, processing state, lease, attempts, next attempt, and fan-out checkpoint. No secrets or email content.
- `notifications`: recipient ID, event/group identity, category, safe structured payload or target reference, created/updated timestamps, `readAt`, and expiry. Index recipient plus ordering/unread state, unique deduplication keys, and expiry; ensure cleanup does not remove pending work.
- `notificationPreferences`: recipient ID and per-category email settings, with explicit defaults for existing and new users. Version preference changes if required for auditing. Future push settings distinguish user intent from browser permission and device subscription.
- `notificationDeliveries`: notification/event, recipient, channel, idempotency key, state, lease, attempts, next retry, and provider metadata. Enforce uniqueness per logical delivery.
- `announcements`: reviewed content in `CHANGELOG.md` is referenced by an explicit publication record with a stable ID, `publishedAt`, and status; a commit or release alone does not publish or notify. An authorized publisher selects an entry to publish, and may withdraw it from normal display while preserving who published or withdrew it, when, and why. Per-user last-viewed state acknowledges only content actually presented, uses a server-side viewing cutoff, and must not move backwards. New status requires `publishedAt` later than both account creation and the last acknowledged view, so entries published while the page is open remain new. Implement acknowledgement carefully for pagination so unseen entries are not inadvertently cleared.
- Essential service notice publication requires restricted authorization and an audit record of reason, audience, approver, channels, and publication time. Limit classification to material security, privacy, account-access, or significant service changes, not ordinary releases or feature promotion. Require a second authorized reviewer where available; allow emergency publication with mandatory retrospective review.
- Authenticated endpoints or server actions: paginated list and unread count; mark one or all read; get/update preferences; list What's New and acknowledge viewed content. Use stable cursor ordering, idempotent read operations, ownership checks, bounded page sizes, and clear error responses. Mark-all uses a server-issued cutoff and marks only activity at or before it; use each group's latest activity timestamp and an atomic update so concurrently arriving activity remains unread.
- Include a notification-settings link in optional emails and a direct unsubscribe mechanism for promotional or discovery emails. Explain why essential security notices are sent and do not offer a misleading unsubscribe control. Review classification and applicable requirements for the jurisdictions served.

### Example notification DTO

This is a proposed **client-facing** shape, not the outbox or delivery-job schema. The server derives the recipient from the session and returns only information that recipient may currently see. IDs below are illustrative; timestamps are ISO 8601 UTC strings.

```ts
type NotificationDto = {
  id: string
  type: "project.referenced" | "project.starred" | "account.security_alert" | "product.announcement" | "service.essential_notice"
  createdAt: string
  updatedAt: string
  readAt: string | null
  // Safe display text generated by the server; render as text, not HTML.
  title: string
  body: string
  // A typed internal target, never an arbitrary URL. Null when unavailable.
  target: { type: "project"; id: string } | { type: "account_security" } | { type: "whats_new" } | null
  // Null for ungrouped events. Counts reflect distinct events, not retries.
  group: { count: number; firstOccurredAt: string; lastOccurredAt: string } | null
}

type NotificationListDto = {
  notifications: NotificationDto[]
  unreadCount: number
  nextCursor: string | null
}
```

For example, a project reference returned by the list endpoint could be:

```json
{
  "id": "notification_123",
  "type": "project.referenced",
  "createdAt": "2026-11-20T08:00:00.000Z",
  "updatedAt": "2026-11-20T08:00:00.000Z",
  "readAt": null,
  "title": "Your project was referenced",
  "body": "Another capstone referenced your project.",
  "target": { "type": "project", "id": "507f1f77bcf86cd799439011" },
  "group": null
}
```

`readAt: null` means unread. A reference notification points to the referencing project when accessible; a star notification points to the starred project. For example, a star item can use `type: "project.starred"`, title `"Your project received a star"`, and body `"Someone starred your project."` A security alert uses an account-security target or no target; a product announcement uses `whats_new` and links to `/whats-new`. If access to a project is lost, the server must either omit the item or return generic text and `target: null`; it must not retain a private title in the response. What's New entries have their own DTO, separate from optional notifications about them. Final category-specific fields and pagination envelope remain implementation decisions.

## Delivery phases

1. **Resolve policy and infrastructure.** Complete the implementation prerequisites below, including security event capture, worker deployment, MongoDB transaction support, sender configuration, and monitoring. Document event schemas and acceptance criteria. Review `lib/legal/policy.ts` for new processing and communication purposes.
2. **Foundation and in-app activity.** Add indexes, event/outbox writes, worker and idempotent fan-out, notification storage, access checks, and list/read APIs. Wire the bell's All and Unread views, badge, loading/error/empty states, pagination, and read controls. Refresh on focus and use a modest polling interval while the app is active; avoid polling hidden tabs. Keep Action Required visible and selectable with no notification types assigned. Add preferences storage and settings before email delivery.
3. **What's New.** Add `/whats-new`, its `CHANGELOG.md` reference and explicit publication workflow, last-viewed state, new-content indicator, optional personal announcements, and publication/withdrawal access controls.
4. **Email.** Add category controls, templates, weekly opt-in digest scheduling, durable delivery and retry monitoring. Roll out to a small cohort after validating configuration, preferences, security exceptions, and recovery.
5. **Browser push later.** After the core is stable, implement service worker, per-device subscription lifecycle, server-side subscription validation, delivery/retry and expired-subscription cleanup. Ask permission only from a contextual Enable action; handle denied/unsupported states and disable/revoke controls. Select useful, time-sensitive types and privacy-safe payloads. No permission prompt at page load.

## Verification and operations

- Follow test-first development. Unit tests cover category policy, reference diffs, grouping, watermark and preference decisions. Integration tests with a transaction-capable MongoDB cover atomic commit/rollback, replay, unique constraints, fan-out checkpoints, leases, retries, concurrent read state, and recipient isolation. E2E tests cover bell, settings, read actions, What's New, and opt-in push when implemented. Aim for the repository's 80% coverage requirement with meaningful coverage of new code.
- Test withdrawn or inaccessible targets, self-events, star insert and outbox rollback, duplicate star requests, concurrent stars, unstar/re-star and grouping after read, stale preferences, old/new email destinations, completed versus requested resets, successful security operations despite delivery failure, worker crashes, provider timeouts, multi-device state, and announcements published before account creation or while the page is open.
- Monitor oldest pending event, queue depth, lease expiry, retry/dead-letter counts, delivery failures and duplicate indicators. The named deployment operator or on-call maintainer receives repeated-failure alerts, investigates dead letters, and controls safe replay. Provide documented safe replay and retention cleanup procedures; do not log secrets or notification content unnecessarily. Production email is not ready until an owner is assigned.
- Roll out behind independently controllable in-app, email, and push flags. Verify the worker and production database first, observe a limited cohort, then expand. Disable delivery independently while preserving durable events for safe recovery.

## Implementation prerequisites

1. Verify the Better Auth integration, capture guarantee, deduplication, and recovery path for each security event before enabling it. Confirm the real account flows and suspension triggers exist.
2. Implement and review the exact changelog-entry reference format, paginated acknowledgement behavior, publisher permissions, and essential-notice audit workflow.
3. Identify the production worker hosting environment and name its operational owner. Confirm MongoDB transaction support, sender configuration, and jurisdiction-specific email requirements.
4. Decide defaults explicitly for any future important project email category when it is introduced; reference email remains off by default.

**Handoff:** Architecture review and the remaining decisions are needed before implementation, particularly for security event capture, announcement publishing, and worker deployment. Then implement in the phases above with tests first and review after each phase.
