import assert from "node:assert/strict";
import test from "node:test";
import { recordVisitFailure } from "../src/visit_failure.js";

test("a failed photo inspection sends the work order to technician follow-up", async () => {
  const calls: Array<{ fingerprint: string[]; idempotencyKey: string }> = [];
  const result = await recordVisitFailure(
    {
      workOrderId: "WO-1842",
      dispatchStatus: "on_site",
      technicianId: "TECH-17",
      photoIds: ["PHOTO-901"],
      agentStep: "inspect_photos",
      error: { name: "PhotoInspectionError", message: "No damage class selected" },
    },
    async (payload, idempotencyKey) => {
      calls.push({ fingerprint: payload.fingerprint, idempotencyKey });
      return { event_id: "evt_1842", error_group_id: "grp_photo_inspection" };
    },
  );

  assert.equal(result.dispatchStatus, "technician_follow_up");
  assert.equal(result.captured.error_group_id, "grp_photo_inspection");
  assert.deepEqual(calls[0], {
    fingerprint: ["field-service-agent", "inspect_photos"],
    idempotencyKey: "work-order:WO-1842:inspect_photos:failure",
  });
});
