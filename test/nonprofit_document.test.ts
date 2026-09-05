import assert from "node:assert/strict";
import test from "node:test";
import { modelNonprofitDocument } from "../src/nonprofit_document";

test("a receipt with donor and amount is ready for acknowledgment", () => {
  const document = modelNonprofitDocument(
    "donor_receipt",
    "DONATION RECEIPT\nDonor: Ada Lovelace\nAmount: USD 125.00\nThank you"
  );

  assert.deepEqual(document, {
    kind: "donor_receipt",
    text: "DONATION RECEIPT\nDonor: Ada Lovelace\nAmount: USD 125.00\nThank you",
    donorName: "Ada Lovelace",
    amount: 125,
    currency: "USD",
    acknowledgment: "ready"
  });
});

test("an incomplete receipt is held for review", () => {
  const document = modelNonprofitDocument("donor_receipt", "DONATION RECEIPT\nAmount: $40.00");

  assert.equal(document.kind, "donor_receipt");
  assert.equal(document.acknowledgment, "needs_review");
});
