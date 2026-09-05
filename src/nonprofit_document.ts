import { z } from "zod";

export const extractionRequestSchema = z.object({
  image: z.string().min(1),
  documentKind: z.enum(["donor_receipt", "volunteer_reminder", "campaign_report"]),
  language: z.string().min(2).default("en"),
  vendor: z.string().min(1).optional()
}).strict();

export type ExtractionRequest = z.infer<typeof extractionRequestSchema>;

export type NonprofitDocument =
  | {
      kind: "donor_receipt";
      text: string;
      donorName: string | null;
      amount: number | null;
      currency: string | null;
      acknowledgment: "ready" | "needs_review";
    }
  | {
      kind: "volunteer_reminder";
      text: string;
      event: string | null;
      startsAt: string | null;
      reminder: "ready" | "needs_review";
    }
  | {
      kind: "campaign_report";
      text: string;
      campaign: string | null;
      raised: number | null;
      currency: string | null;
      reporting: "ready" | "needs_review";
    };

function capture(text: string, pattern: RegExp): string | null {
  return pattern.exec(text)?.[1]?.trim() ?? null;
}

function money(text: string, label: string): { amount: number | null; currency: string | null } {
  const match = new RegExp(`${label}\\s*[:#-]?\\s*(USD|EUR|GBP)?\\s*([$€£])?\\s*([0-9]+(?:[.,][0-9]{1,2})?)`, "i").exec(text);
  if (!match) return { amount: null, currency: null };

  const symbolCurrency: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP" };
  return {
    amount: Number(match[3].replace(",", ".")),
    currency: match[1]?.toUpperCase() ?? (match[2] ? symbolCurrency[match[2]] : null)
  };
}

export function modelNonprofitDocument(kind: ExtractionRequest["documentKind"], text: string): NonprofitDocument {
  if (kind === "donor_receipt") {
    const donorName = capture(text, /(?:donor|received from)\s*[:#-]?\s*([^\n]+)/i);
    const donation = money(text, "(?:amount|donation)");
    return {
      kind,
      text,
      donorName,
      amount: donation.amount,
      currency: donation.currency,
      acknowledgment: donorName && donation.amount !== null ? "ready" : "needs_review"
    };
  }

  if (kind === "volunteer_reminder") {
    const event = capture(text, /event\s*[:#-]?\s*([^\n]+)/i);
    const startsAt = capture(text, /(?:starts?|date)\s*[:#-]?\s*([^\n]+)/i);
    return {
      kind,
      text,
      event,
      startsAt,
      reminder: event && startsAt ? "ready" : "needs_review"
    };
  }

  const campaign = capture(text, /campaign\s*[:#-]?\s*([^\n]+)/i);
  const total = money(text, "(?:raised|total)");
  return {
    kind,
    text,
    campaign,
    raised: total.amount,
    currency: total.currency,
    reporting: campaign && total.amount !== null ? "ready" : "needs_review"
  };
}
