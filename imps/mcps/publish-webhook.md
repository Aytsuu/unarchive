# Webhook Notification for Publication Submissions

## Summary

When a new publication submission or revision resubmission is saved, notify the existing Grok bot through its webhook. The bot can then review that submission using the development MCP endpoint exposed through the existing ngrok tunnel.

## Implementation changes

- Save a webhook delivery record atomically with each new submission and revision resubmission. Use the new submission snapshot's ID as the event identity so request retries do not create duplicate notifications, while each resubmitted snapshot receives its own event.
- Add a local background delivery worker to the development stack. It sends an HTTPS POST containing the event type and submission ID, authenticates with a configured bearer secret, and retries failed deliveries with bounded backoff. Record delivery failures for inspection; a failed webhook must not undo an accepted submission.
- Add a `get_pending_submission` MCP tool that accepts a submission ID and returns its review details. This lets the bot review the notified submission even when it is outside the existing 100-item queue limit. Continue using the existing approval and revision tools for decisions.
- Configure the webhook URL and secret through local environment variables. Configure the bot separately with the agreed JSON contract and the existing ngrok MCP URL; changes to the external bot are outside this repository's scope.
- Keep the integration development-only. Document startup, configuration, delivery status, and the fact that the tunneled MCP endpoint remains unauthenticated.

## Initial file structure

```text
apps/web/
  app/api/projects/route.ts                # Create a submission and delivery record atomically
  app/api/submissions/[id]/resubmit/route.ts # Create a resubmission and delivery record atomically
  lib/mcp/publish-moderation.ts            # Register the targeted submission lookup tool
  lib/webhooks/publish-moderation.ts        # Delivery, retry, and status handling
packages/domain/
  submissions.mjs                         # Shared submission and transaction behavior
scripts/
  process-publish-webhooks.mjs             # Background delivery worker entry point
  dev.ps1                                  # Start and track the worker with the local stack
  stop.ps1                                 # Stop the tracked worker
tests/
  publish-webhook.test.mts                 # Delivery and retry behavior
  publish-webhook.integration.mts          # Submission and delivery persistence
  publish-moderation-mcp.test.mts          # Targeted MCP lookup coverage
.env.examples                              # Local webhook configuration placeholders
```

The webhook worker notifies the existing external bot; the bot itself and its webhook receiver are outside this repository's scope.

## Test plan

- Verify that successful new submissions and revision resubmissions each create one delivery record and send the expected authenticated webhook; idempotent request retries must not create another event.
- Verify each resubmitted snapshot gets a distinct event, and failed submission or resubmission transactions create no delivery record.
- Verify retries, eventual success, exhausted retries, worker restarts, and acceptance of submissions while the bot is unavailable.
- Verify targeted MCP lookup, including a submission beyond the queue limit, invalid IDs, missing submissions, and submissions already decided.
- Run the relevant moderation, integration, and development-stack checks.

## Assumptions

- The bot accepts a new JSON webhook contract and validates the shared bearer secret.
- Delivery is **at least once**: the bot must treat repeated notifications for the same submission ID as the same event.
- The existing ngrok tunnel is already configured. Because the development MCP endpoint has no authentication, anyone who can reach its tunnel URL can invoke its moderation tools.
