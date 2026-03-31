import * as fs from "fs";
import * as path from "path";
import { prisma } from "../lib/prisma";
import { parseEmlFile, buildContentString, parsePdfFile, buildPdfContentString } from "./email-parser";
import { extractSubmissionData } from "./anthropic";

const INGESTABLE_EXTENSIONS = [".eml", ".pdf"];

interface IngestionResult {
  file: string;
  status: "success" | "skipped" | "error";
  submissionId?: string;
  error?: string;
}

export function collectIngestableFiles(dir: string): string[] {
  const results: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectIngestableFiles(fullPath));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (INGESTABLE_EXTENSIONS.includes(ext)) {
        results.push(fullPath);
      }
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

export async function ingestSinglePdf(
  filePath: string
): Promise<IngestionResult> {
  const fileName = path.basename(filePath);

  const existing = await prisma.submission.findUnique({
    where: { sourceFile: fileName },
  });

  if (existing) {
    return { file: fileName, status: "skipped", submissionId: existing.id };
  }

  console.log(`Parsing PDF: ${fileName}`);
  const parsed = await parsePdfFile(filePath);
  const pdfContent = buildPdfContentString(parsed);

  console.log(`Extracting data via Anthropic for: ${fileName}`);
  const extracted = await extractSubmissionData(pdfContent);

  const submission = await prisma.submission.create({
    data: {
      sourceFile: fileName,
      rawBody: parsed.text || null,
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

  const files = collectIngestableFiles(emailDir);
  const emlCount = files.filter((f) => f.endsWith(".eml")).length;
  const pdfCount = files.filter((f) => f.endsWith(".pdf")).length;
  console.log(`Found ${files.length} ingestable files in ${emailDir} (${emlCount} .eml, ${pdfCount} .pdf)`);

  const results: IngestionResult[] = [];

  for (const filePath of files) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const result = ext === ".pdf"
        ? await ingestSinglePdf(filePath)
        : await ingestSingleEmail(filePath);
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
