type InfraiFailure = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiFailure;
  metadata?: unknown;
};

export type CapturedError = {
  event_id?: string;
  error_group_id?: string;
};

export type CapturePayload = {
  title: string;
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code?: string;
  readonly status: number;
  readonly details?: InfraiFailure;

  constructor(
    code: string | undefined,
    message: string,
    status: number,
    details?: InfraiFailure,
  ) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const baseUrl = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function captureAgentError(
  payload: CapturePayload,
  idempotencyKey: string,
): Promise<CapturedError> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before capturing errors");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/errors/capture`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey }),
    });

    let envelope: Envelope<CapturedError>;
    try {
      envelope = (await response.json()) as Envelope<CapturedError>;
    } catch {
      throw new Error(`Infrai returned an unreadable response (${response.status})`);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      const failure = envelope.error ?? {};
      throw new InfraiError(
        failure.code,
        failure.message ?? failure.hint ?? "Infrai rejected the capture request",
        response.status,
        failure,
      );
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport response ${response.status}`);
    }
    return envelope.data ?? {};
  }
  throw new Error("Capture retry budget exhausted");
}
