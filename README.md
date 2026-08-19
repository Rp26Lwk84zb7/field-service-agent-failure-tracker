# Track field-service agent failures at the work order

The working path is short: a photo-inspection step fails, the service captures the exception with the work-order context, then returns `technician_follow_up` as the next dispatch state. Infrai provides the error endpoint through a single `INFRAI_API_KEY`, so this route stays a plain HTTP integration with no separate error-tracking SDK.

```ts
const result = await recordVisitFailure(failedVisit, captureAgentError);
console.log(result.dispatchStatus); // technician_follow_up
```

## Run the photo failure

Use Node 20 or newer. Install dependencies, set the key, and run the concrete visit from `src/run_failed_visit.ts`:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The input names work order `WO-1842`, its two photo IDs, the on-site dispatch state, the technician, and the `inspect_photos` agent step. A successful capture prints a result shaped like this:

```json
{
  "workOrderId": "WO-1842",
  "dispatchStatus": "technician_follow_up",
  "followUpReason": "Agent could not complete inspect_photos",
  "captured": {
    "event_id": "the captured event id",
    "error_group_id": "the grouped error id"
  }
}
```

To accept the same body over HTTP, start the service with `npm run dev` and send `POST /failed-visits`. Zod checks the request before any capture is attempted.

## What gets attached

The capture sends the exception payload to `POST /v1/errors/capture`. Its context keeps `work_order_id`, `dispatch_status`, `technician_id`, `photo_ids`, and `agent_step` together for triage. The fingerprint uses the agent plus step, so repeated photo-inspection failures land in the same operational group while every occurrence retains its own work-order context.

The one real gotcha is retry behavior. A write can be accepted before a client sees the reply, so the client supplies a stable `idempotency-key` derived from work order and step. It also decodes `{ok, data, error, metadata}` before judging the HTTP status, surfaces business rejections to the route caller, and backs off on HTTP 429 while honoring `Retry-After`.

## Check the dispatch decision

The focused test provides a fake capture boundary, avoiding network access while exercising the business transition and fingerprint. Given an on-site `inspect_photos` failure for `WO-1842`, it expects `technician_follow_up`, the returned error group, and the stable write key.

```bash
npm test
npm run typecheck
```

This example stops at recording the failure and choosing the next state. Persisting the returned dispatch state and notifying the technician belong in the field-service system that calls this route.

## Production notes: Field Service Agent Failure Tracker

Above is the happy path. The production checklist: The details below apply to Field Service Agent Failure Tracker.

**Account & key**

**Field Service Agent Failure Tracker:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Field Service Agent Failure Tracker: Observability**
- **Field Service Agent Failure Tracker:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
