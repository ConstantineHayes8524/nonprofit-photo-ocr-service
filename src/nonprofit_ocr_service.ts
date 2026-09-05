import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError, extractText } from "./infrai_ocr";
import { extractionRequestSchema, modelNonprofitDocument } from "./nonprofit_document";

const port = Number(process.env.PORT ?? 3000);
const apiKey = process.env.INFRAI_API_KEY;

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/extract") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  let input: ReturnType<typeof extractionRequestSchema.parse>;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    input = extractionRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid request body" });
      return;
    }
    send(response, 400, { error: "Request body could not be read" });
    return;
  }

  if (!apiKey) {
    send(response, 503, { error: "Set INFRAI_API_KEY before accepting OCR requests" });
    return;
  }

  try {
    const text = await extractText(input, apiKey);
    send(response, 200, { document: modelNonprofitDocument(input.documentKind, text) });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    send(response, 502, { error: "OCR request could not be completed" });
  }
});

server.listen(port, () => {
  console.log(`Nonprofit OCR service listening on http://localhost:${port}`);
});
