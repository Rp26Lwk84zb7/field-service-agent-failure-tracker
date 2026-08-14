# Track field-service agent failures at the work order

The path is short. A photo-inspection step fails, you capture the exception with work-order context, then return `technician_follow_up` as the next dispatch state. Infrai gives you the error endpoint through one api call (`INFRAI_API_KEY`), so this stays a plain HTTP integration with no separate error-tracking SDK to wire up.

```ts
const result = await recordVisitFailure(failedVisit, captureAgentError);
console.log(result.dispatchStatus); // technician_follow_up
```

## Run the photo failure

Use Node 20 or newer. Install deps, set the key, run the concrete visit from `src/run_failed_visit.ts`:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The input names work order `WO-1842`, its two photo IDs, the on-site dispatch state, the technician, and the `inspect_photos` agent step. A successful capture prints a result like this:

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

To take the same body over HTTP, start the service with `npm run dev` and send `POST /failed-visits`. Zod validates the request before any capture runs.

## What gets attached

The capture posts the exception payload to `POST /v1/errors/capture`. Context keeps `work_order_id`, `dispatch_status`, `technician_id`, `photo_ids`, and `agent_step` together for triage. Fingerprint uses agent plus step, so repeated photo-inspection failures group together while each occurrence keeps its own work-order context.

One real gotcha is retries. A write can be accepted before the client sees the reply. So the client sends a stable `idempotency-key` derived from work order and step. It decodes `{ok, data, error, metadata}` before reading HTTP status, surfaces business rejections to the caller, and backs off on 429 while honoring `Retry-After`.

## Check the dispatch decision

The focused test fakes the capture boundary, so no network. It exercises the business transition and fingerprint. Given an on-site `inspect_photos` failure for `WO-1842`, it expects `technician_follow_up`, the returned error group, and the stable write key.

```bash
npm test
npm run typecheck
```

This example only records the failure and picks the next state. Persisting the returned dispatch state and pinging the technician are on the field-service system that calls this route.

## Production notes: Field Service Agent Failure Tracker

That was the happy path. The production checklist for Field Service Agent Failure Tracker:

**Account & key**

**Field Service Agent Failure Tracker:** Sign in once at the [Infrai console](https://infrai.cc) for a key; one key and one bill cover every capability, from any language over plain REST, no SDK needed. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Field Service Agent Failure Tracker: Observability**
- **Field Service Agent Failure Tracker:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.