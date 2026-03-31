import * as fs from "fs";
import * as path from "path";
import { prisma } from "../lib/prisma";
import { parseEmlFile, buildContentString } from "./email-parser";
import { extractSubmissionData } from "./anthropic";

interface IngestionResult {
  file: string;
  status: "success" | "skipped" | "error";
  submissionId?: string;
  error?: string;
}

export function collectEmlFiles(dir: string): string[] {
  const results: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectEmlFiles(fullPath));
    } else if (entry.name.endsWith(".eml")) {
      results.push(fullPath);
    }
  }

  return results;
}

export async function ingestSingleEmail(
  filePath: string
): Promise<IngestionResult> {
  const fileName = path.basename(filePath);

  const existing = await prisma.submission.findUnique({
    where: { sourceFile: fileName },
  });

  if (existing) {
    return { file: fileName, status: "skipped", submissionId: existing.id };
  }

  console.log(`Parsing: ${fileName}`);
  const parsed = await parseEmlFile(filePath);
  const emailContent = buildContentString(parsed);

  console.log(`Extracting data via Anthropic for: ${fileName}`);
  const extracted = await extractSubmissionData(emailContent);

  const submission = await prisma.submission.create({
    data: {
      sourceFile: fileName,
      emailFrom: parsed.from,
      emailTo: parsed.to,
      emailSubject: parsed.subject,
      emailDate: parsed.date,
      rawBody: parsed.textBody || parsed.htmlBody || null,
      insured: extracted.insured
        ? { create: extracted.insured }
        : undefined,
      broker: extracted.broker
        ? { create: extracted.broker }
        : undefined,
      linesOfBusiness:
        extracted.linesOfBusiness.length > 0
          ? { create: extracted.linesOfBusiness }
          : undefined,
      limits:
        extracted.limits.length > 0
          ? { create: extracted.limits }
          : undefined,
      targetPricing:
        extracted.targetPricing.length > 0
          ? { create: extracted.targetPricing }
          : undefined,
      exposures: extracted.exposures
        ? { create: extracted.exposures }
        : undefined,
      losses:
        extracted.losses.length > 0
          ? { create: extracted.losses }
          : undefined,
    },
  });

  console.log(`Stored submission: ${submission.id} (${fileName})`);
  return { file: fileName, status: "success", submissionId: submission.id };
}

export async function ingestAllEmails(
  emailDir: string
): Promise<IngestionResult[]> {
  if (!fs.existsSync(emailDir)) {
    throw new Error(`Email directory not found: ${emailDir}`);
  }

  const emlFiles = collectEmlFiles(emailDir);
  console.log(`Found ${emlFiles.length} .eml files in ${emailDir}`);

  const results: IngestionResult[] = [];

  for (const filePath of emlFiles) {
    try {
      const result = await ingestSingleEmail(filePath);
      results.push(result);
    } catch (err) {
      const fileName = path.basename(filePath);
      console.error(`Failed to process ${fileName}:`, err);
      results.push({
        file: fileName,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
