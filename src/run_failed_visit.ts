import { captureAgentError } from "./infrai_errors.js";
import { failedVisitSchema, recordVisitFailure } from "./visit_failure.js";

const failedVisit = failedVisitSchema.parse({
  workOrderId: "WO-1842",
  dispatchStatus: "on_site",
  technicianId: "TECH-17",
  photoIds: ["PHOTO-901", "PHOTO-902"],
  agentStep: "inspect_photos",
  error: {
    name: "PhotoInspectionError",
    message: "The inspection model could not classify the damaged panel",
  },
});

const result = await recordVisitFailure(failedVisit, captureAgentError);
console.log(JSON.stringify(result, null, 2));
