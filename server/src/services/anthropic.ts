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
