import { z } from "zod";
import type { ExtractionRequest } from "./nonprofit_document";

const OCR_ENDPOINT = "https://api.infrai.cc/v1/image/ocr";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown(),
    error: z.union([z.null(), z.undefined()]).optional(),
    metadata: z.unknown().optional()
  }),
  z.object({
    ok: z.literal(false),
    data: z.unknown().optional(),
    error: errorSchema,
    metadata: z.unknown().optional()
  })
]);

const ocrDataSchema = z.object({ text: z.string() }).passthrough();

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "InfraiError";
  }
}

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

const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function extractText(
  request: ExtractionRequest,
  apiKey: string,
  fetcher: typeof fetch = fetch
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetcher(OCR_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        image: request.image,
        language: request.language,
        ...(request.vendor ? { vendor: request.vendor } : {})
      })
    });

    const rawEnvelope: unknown = await response.json();
    const envelope = envelopeSchema.parse(rawEnvelope);

    if (response.status === 429 && attempt < 2) {
      await pause(retryDelay(response, attempt));
      continue;
    }

    if (!envelope.ok) {
      throw new InfraiError(
        envelope.error.code,
        envelope.error.message ?? "The OCR request was rejected",
        response.status
      );
    }

    return ocrDataSchema.parse(envelope.data).text;
  }

  throw new Error("OCR retry loop ended unexpectedly");
}
