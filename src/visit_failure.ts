import { z } from "zod";
import type { CapturePayload, CapturedError } from "./infrai_errors.js";

export const failedVisitSchema = z.object({
  workOrderId: z.string().min(1),
  dispatchStatus: z.enum(["assigned", "en_route", "on_site"]),
  technicianId: z.string().min(1),
  photoIds: z.array(z.string().min(1)).min(1),
  agentStep: z.enum(["inspect_photos", "draft_visit_note", "recommend_repair"]),
  error: z.object({
    name: z.string().min(1),
    message: z.string().min(1),
    stack: z.string().optional(),
  }),
});

export type FailedVisit = z.infer<typeof failedVisitSchema>;

export type FollowUpResult = {
  workOrderId: string;
  dispatchStatus: "technician_follow_up";
  followUpReason: string;
  captured: CapturedError;
};

export type Capture = (
  payload: CapturePayload,
  idempotencyKey: string,
) => Promise<CapturedError>;

export async function recordVisitFailure(
  input: FailedVisit,
  capture: Capture,
): Promise<FollowUpResult> {
  const exception = input.error.stack ?? `${input.error.name}: ${input.error.message}`;
  const captured = await capture(
    {
      title: `Work order ${input.workOrderId}: ${input.agentStep} failed`,
      message: input.error.message,
      level: "error",
      fingerprint: ["field-service-agent", input.agentStep],
      exception,
      context: {
        work_order_id: input.workOrderId,
        dispatch_status: input.dispatchStatus,
        technician_id: input.technicianId,
        photo_ids: input.photoIds,
        agent_step: input.agentStep,
      },
    },
    `work-order:${input.workOrderId}:${input.agentStep}:failure`,
  );

  return {
    workOrderId: input.workOrderId,
    dispatchStatus: "technician_follow_up",
    followUpReason: `Agent could not complete ${input.agentStep}`,
    captured,
  };
}
