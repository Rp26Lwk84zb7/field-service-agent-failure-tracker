import { createServer } from "node:http";
import { ZodError } from "zod";
import { captureAgentError, InfraiError } from "./infrai_errors.js";
import { failedVisitSchema, recordVisitFailure } from "./visit_failure.js";

const port = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/failed-visits") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = failedVisitSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await recordVisitFailure(input, captureAgentError);
    send(response, 202, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid failed-visit body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    send(response, 500, { error: "Could not record visit failure" });
  }
}).listen(port, () => {
  console.log(`Field-service failure route listening on http://localhost:${port}`);
});
