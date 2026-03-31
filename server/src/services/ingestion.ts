import * as fs from "fs";
import * as path from "path";
import { prisma } from "../lib/prisma";
import {
  parseEmlFile,
  parsePdfFile,
  splitEmailIntoSections,
  splitPdfIntoSections,
  type ContentSection,
  type ParsedEmail,
} from "./email-parser";
import {
  extractSubmissionData,
  extractRawSubmissionData,
  mergeExtractionsViaLLM,
} from "./anthropic";
import { mergeExtractions } from "./extraction-merge";
import type { SubmissionExtraction } from "./extraction-schema";

export type ExtractionMode = "standard" | "thorough";

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

async function extractFromSections(
  sections: ContentSection[],
  mode: ExtractionMode,
  fileName: string
): Promise<SubmissionExtraction> {
  if (sections.length === 0) {
    return {
      insured: null,
      broker: null,
      linesOfBusiness: [],
      limits: [],
      targetPricing: [],
      exposures: null,
      losses: [],
    };
  }

  if (sections.length === 1) {
    console.log(`  Single section — extracting directly`);
    return extractSubmissionData(sections[0].content);
  }

  console.log(`  ${sections.length} sections detected (mode: ${mode})`);
  for (const s of sections) {
    console.log(`    • ${s.label} (${s.content.length} chars)`);
  }

  if (mode === "thorough") {
    const partials: Record<string, unknown>[] = [];
    for (let i = 0; i < sections.length; i++) {
      console.log(`  [map ${i + 1}/${sections.length}] Extracting: ${sections[i].label}`);
      const raw = await extractRawSubmissionData(sections[i].content);
      partials.push(raw);
    }
    console.log(`  [reduce] Merging ${partials.length} extractions via LLM for: ${fileName}`);
    return mergeExtractionsViaLLM(partials);
  }

  const partials: SubmissionExtraction[] = [];
  for (let i = 0; i < sections.length; i++) {
    console.log(`  [map ${i + 1}/${sections.length}] Extracting: ${sections[i].label}`);
    const extracted = await extractSubmissionData(sections[i].content);
    partials.push(extracted);
  }
  console.log(`  Merging ${partials.length} extractions programmatically for: ${fileName}`);
  return mergeExtractions(partials);
}

function buildSubmissionCreateData(
  fileName: string,
  extracted: SubmissionExtraction,
  emailMeta?: { parsed: ParsedEmail }
) {
  return {
    sourceFile: fileName,
    emailFrom: emailMeta?.parsed.from,
    emailTo: emailMeta?.parsed.to,
    emailSubject: emailMeta?.parsed.subject,
    emailDate: emailMeta?.parsed.date,
    rawBody: emailMeta
      ? (emailMeta.parsed.textBody || emailMeta.parsed.htmlBody || null)
      : null,
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
  };
}

export async function ingestSingleEmail(
  filePath: string,
  mode: ExtractionMode = "standard"
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
  const sections = splitEmailIntoSections(parsed);

  console.log(`Extracting data via Anthropic for: ${fileName}`);
  const extracted = await extractFromSections(sections, mode, fileName);

  const submission = await prisma.submission.create({
    data: buildSubmissionCreateData(fileName, extracted, { parsed }),
  });

  console.log(`Stored submission: ${submission.id} (${fileName})`);
  return { file: fileName, status: "success", submissionId: submission.id };
}

export async function ingestSinglePdf(
  filePath: string,
  mode: ExtractionMode = "standard"
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
  const sections = splitPdfIntoSections(parsed);

  console.log(`Extracting data via Anthropic for: ${fileName}`);
  const extracted = await extractFromSections(sections, mode, fileName);

  const submission = await prisma.submission.create({
    data: buildSubmissionCreateData(fileName, extracted),
  });

  console.log(`Stored submission: ${submission.id} (${fileName})`);
  return { file: fileName, status: "success", submissionId: submission.id };
}

export async function ingestAllEmails(
  emailDir: string,
  mode: ExtractionMode = "standard"
): Promise<IngestionResult[]> {
  if (!fs.existsSync(emailDir)) {
    throw new Error(`Email directory not found: ${emailDir}`);
  }

  const files = collectIngestableFiles(emailDir);
  const emlCount = files.filter((f) => f.endsWith(".eml")).length;
  const pdfCount = files.filter((f) => f.endsWith(".pdf")).length;
  console.log(`Found ${files.length} ingestable files in ${emailDir} (${emlCount} .eml, ${pdfCount} .pdf)`);
  console.log(`Extraction mode: ${mode}`);

  const results: IngestionResult[] = [];

  for (const filePath of files) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const result = ext === ".pdf"
        ? await ingestSinglePdf(filePath, mode)
        : await ingestSingleEmail(filePath, mode);
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
