import Anthropic from "@anthropic-ai/sdk";
import {
  SubmissionExtractionSchema,
  type SubmissionExtraction,
} from "./extraction-schema";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert insurance data extraction assistant. You will be given the contents of a commercial insurance submission email. Your job is to extract structured data from it.

Extract the following categories of information and return them using EXACTLY these JSON keys:

{
  "insured": { "companyName", "contactName", "mailingAddress", "dotNumber", "mcNumber", "yearsInBusiness", "state" },
  "broker": { "companyName", "contactName", "email", "phone" },
  "linesOfBusiness": [{ "type" }],
  "limits": [{ "lineOfBusiness", "limitAmount", "deductible", "description" }],
  "targetPricing": [{ "lineOfBusiness", "targetPremium", "currentPremium", "description" }],
  "exposures": { "numberOfTrucks", "numberOfDrivers", "numberOfTrailers", "radius", "commodities": ["string"], "annualRevenue", "annualMileage", "operatingStates": ["string"], "vehicleTypes": ["string"] },
  "losses": [{ "policyYear", "numberOfClaims", "totalIncurred", "totalPaid", "description" }]
}

Rules:
- Use null for fields where data is not available in the email.
- Do NOT invent data — only extract what is explicitly stated or strongly implied.
- Return ONLY valid JSON. No markdown fencing, no explanation, no preamble.`;

function parseJsonResponse(text: string): Record<string, unknown> {
  let jsonStr = text.trim();

  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  return JSON.parse(jsonStr);
}

export async function extractRawSubmissionData(
  emailContent: string
): Promise<Record<string, unknown>> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Extract structured insurance submission data from the following email content. Return ONLY valid JSON using the exact keys from the schema.\n\n---\n\n${emailContent}`,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Anthropic");
  }

  return parseJsonResponse(textBlock.text);
}

export async function extractSubmissionData(
  emailContent: string
): Promise<SubmissionExtraction> {
  const raw = await extractRawSubmissionData(emailContent);
  return SubmissionExtractionSchema.parse(raw);
}

export async function extractRawFromPdfDocument(
  pdfBuffer: Buffer
): Promise<Record<string, unknown>> {
  const base64Data = pdfBuffer.toString("base64");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Data,
            },
          },
          {
            type: "text",
            text: "Extract structured insurance submission data from this PDF document. Read all tables, numbers, and figures carefully — numerical accuracy is critical. Return ONLY valid JSON using the exact keys from the schema.",
          },
        ],
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Anthropic (PDF document)");
  }

  return parseJsonResponse(textBlock.text);
}

export async function extractFromPdfDocument(
  pdfBuffer: Buffer
): Promise<SubmissionExtraction> {
  const raw = await extractRawFromPdfDocument(pdfBuffer);
  return SubmissionExtractionSchema.parse(raw);
}

const MERGE_SYSTEM_PROMPT = `You are an expert insurance data merging assistant. You will receive multiple partial JSON extractions from different sections of the same insurance submission (e.g. email body, PDF attachments, loss runs).

Your job is to merge them into a single unified extraction using EXACTLY these JSON keys:

{
  "insured": { "companyName", "contactName", "mailingAddress", "dotNumber", "mcNumber", "yearsInBusiness", "state" },
  "broker": { "companyName", "contactName", "email", "phone" },
  "linesOfBusiness": [{ "type" }],
  "limits": [{ "lineOfBusiness", "limitAmount", "deductible", "description" }],
  "targetPricing": [{ "lineOfBusiness", "targetPremium", "currentPremium", "description" }],
  "exposures": { "numberOfTrucks", "numberOfDrivers", "numberOfTrailers", "radius", "commodities": ["string"], "annualRevenue", "annualMileage", "operatingStates": ["string"], "vehicleTypes": ["string"] },
  "losses": [{ "policyYear", "numberOfClaims", "totalIncurred", "totalPaid", "description" }]
}

Merge rules:
- For singular objects (insured, broker, exposures): combine fields from all sources. When the same field has different non-null values, prefer the most specific/complete value.
- For arrays (losses, limits, linesOfBusiness, targetPricing): include all unique entries. Deduplicate semantically — if two sources describe the same loss year or same limit, merge them into one entry with the most complete data.
- Use null for fields where no source provides data.
- Do NOT invent data.
- Return ONLY valid JSON. No markdown fencing, no explanation, no preamble.`;

export async function mergeExtractionsViaLLM(
  partials: Record<string, unknown>[]
): Promise<SubmissionExtraction> {
  const partialsJson = partials
    .map((p, i) => `--- Partial extraction #${i + 1} ---\n${JSON.stringify(p, null, 2)}`)
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Merge the following ${partials.length} partial insurance submission extractions into a single unified extraction. Return ONLY valid JSON.\n\n${partialsJson}`,
      },
    ],
    system: MERGE_SYSTEM_PROMPT,
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Anthropic during merge");
  }

  const raw = parseJsonResponse(textBlock.text);
  return SubmissionExtractionSchema.parse(raw);
}
