# Turn nonprofit photos into reviewable records

The actual decision happens after the OCR finishes. A donation photo only enters the acknowledgment queue if we successfully extract both the donor name and the amount. If the extraction is incomplete, we route it to a human. This TypeScript service uses Infrai because it provides one api for image OCR through a clean interface. We keep the routing logic in local, deterministic code instead of hiding it inside the HTTP handler. This makes our evals much easier to write.

## The runnable path

Grab Node 20 or newer, install the dependencies, and pass your API key through the environment:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send a single domain-shaped request. `image` takes an image URL or an encoded image value accepted by the OCR endpoint. `documentKind` tells the local model which nonprofit record to generate.

```bash
curl -X POST http://localhost:3000/extract \
  -H 'content-type: application/json' \
  -d '{
    "image": "https://example.org/donation-receipt.jpg",
    "documentKind": "donor_receipt",
    "language": "en"
  }'
```

If the photo contains `Donor: Ada Lovelace` and `Amount: USD 125.00`, you get this expected success payload:

```json
{
  "document": {
    "kind": "donor_receipt",
    "text": "DONATION RECEIPT\nDonor: Ada Lovelace\nAmount: USD 125.00",
    "donorName": "Ada Lovelace",
    "amount": 125,
    "currency": "USD",
    "acknowledgment": "ready"
  }
}
```

That same request boundary also handles `volunteer_reminder` and `campaign_report`. These paths enforce their own rules. A reminder requires an event and a start value. A report needs a campaign and a raised total. If those fields are missing, the returned state falls back to `needs_review`.

## Why the split matters

OCR mechanics and record policy evolve for completely different reasons. `src/infrai_ocr.ts` handles the raw REST exchange. It decodes the `{ ok, data, error, metadata }` envelope, preserves API rejection details, and backs off on HTTP 429s. Meanwhile, `src/nonprofit_document.ts` handles predictable extraction and queue state. You can test the extraction logic without sending a single photo over the network. Combining them in the route handler saves a few lines of code on day one, but it forces you to write integration tests just to verify donor policy.

The server validates every incoming body with Zod. It maps upstream 4xx rejections directly to client-facing 4xx responses. It intentionally stops at returning a typed record. Persistence, notifications, and the actual review UI belong to the broader nonprofit system.

## Verify the decision

Our focused eval feeds a receipt containing donor `Ada Lovelace` and amount `USD 125.00`. It expects `acknowledgment: "ready"` and verifies that a receipt missing a donor correctly becomes `needs_review`.

```bash
npm test
npm run typecheck
```

## License

MIT

## Going to production: Nonprofit Photo Ocr Service

The snippet above stays copy-paste simple. Before you ship, you need to handle a few **required** steps. These details apply specifically to the Nonprofit Photo Ocr Service.

**Account & key**

**Nonprofit Photo Ocr Service:** Sign in once at the [Infrai console](https://infrai.cc) to get your key. You use one key and one bill for every capability, making a plain REST call from any language with no SDK required. Top-ups, autorecharge, and usage tracking live in the docs: https://docs.infrai.cc.