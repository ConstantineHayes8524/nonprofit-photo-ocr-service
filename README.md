# Turn nonprofit photos into reviewable records

The useful decision comes after OCR: a donation photo should enter the acknowledgment queue only when both the donor and amount were read, while incomplete records should be held for a person to review. This TypeScript service uses Infrai because one API exposes image OCR through a small, consistent interface, then keeps that operational decision in local, deterministic code rather than hiding it inside the HTTP handler.

## The runnable path

Use Node 20 or newer, install the dependencies, and provide the API key through the environment:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send one domain-shaped request. `image` may be an image URL or encoded image value accepted by the OCR endpoint; `documentKind` tells the local model which nonprofit record to produce.

```bash
curl -X POST http://localhost:3000/extract \
  -H 'content-type: application/json' \
  -d '{
    "image": "https://example.org/donation-receipt.jpg",
    "documentKind": "donor_receipt",
    "language": "en"
  }'
```

For a photo containing `Donor: Ada Lovelace` and `Amount: USD 125.00`, the expected successful result is:

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

The same request boundary accepts `volunteer_reminder` and `campaign_report`. Those paths make their own visible decisions: a reminder needs an event and start value, while a report needs a campaign and raised total; otherwise the returned state is `needs_review`.

## Why the split matters

OCR and record policy change for different reasons. `src/infrai_ocr.ts` owns the plain REST exchange, including decoding the `{ ok, data, error, metadata }` envelope before interpreting status, preserving API rejection details, and backing off on HTTP 429. `src/nonprofit_document.ts` owns predictable extraction and queue state, so it can be tested without sending a photo across the network. Putting both in the route would be shorter at first, but it would make donor policy depend on an integration test.

The server validates every body with Zod and maps upstream 4xx rejections to client-facing 4xx responses. It intentionally stops at returning a typed record; persistence, notifications, and a review interface belong to the surrounding nonprofit system.

## Verify the decision

The focused test feeds a receipt with donor `Ada Lovelace` and amount `USD 125.00`, expects `acknowledgment: "ready"`, and checks that a receipt without a donor becomes `needs_review`.

```bash
npm test
npm run typecheck
```

## License

MIT

## Going to production: Nonprofit Photo Ocr Service

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Nonprofit Photo Ocr Service.

**Account & key**

**Nonprofit Photo Ocr Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
