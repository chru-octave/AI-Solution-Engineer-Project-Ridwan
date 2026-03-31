import * as path from "path";
import * as fs from "fs";
import { parseEmlFile, buildContentString } from "../services/email-parser";
import { extractRawSubmissionData } from "../services/anthropic";
import { SubmissionExtractionSchema } from "../services/extraction-schema";
import { collectEmlFiles } from "../services/ingestion";

const DIVIDER = "─".repeat(60);

function printHeader(label: string) {
  console.log(`\n${DIVIDER}`);
  console.log(`  ${label}`);
  console.log(DIVIDER);
}

function printSection(title: string, data: unknown) {
  console.log(`\n  ▸ ${title}:`);
  if (data === null || data === undefined) {
    console.log("    (none)");
    return;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log("    (empty array)");
      return;
    }
    data.forEach((item, i) => {
      console.log(`    [${i + 1}]`, JSON.stringify(item, null, 2).replace(/\n/g, "\n    "));
    });
  } else if (typeof data === "object") {
    console.log(`    ${JSON.stringify(data, null, 2).replace(/\n/g, "\n    ")}`);
  } else {
    console.log(`    ${data}`);
  }
}

async function previewSingle(filePath: string, skipLlm: boolean) {
  const fileName = path.basename(filePath);
  printHeader(fileName);

  console.log("\n  Parsing email...");
  const parsed = await parseEmlFile(filePath);

  console.log(`  From:    ${parsed.from || "(unknown)"}`);
  console.log(`  To:      ${parsed.to || "(unknown)"}`);
  console.log(`  Subject: ${parsed.subject || "(unknown)"}`);
  console.log(`  Date:    ${parsed.date?.toISOString() || "(unknown)"}`);
  console.log(`  Body:    ${parsed.textBody.length} chars (text), ${parsed.htmlBody.length} chars (html)`);

  if (parsed.attachments.length > 0) {
    console.log(`\n  Attachments (${parsed.attachments.length}):`);
    for (const att of parsed.attachments) {
      const extracted = att.text ? `${att.text.length} chars extracted` : "binary — not extracted";
      console.log(`    • ${att.filename} (${att.contentType}, ${att.size} bytes) → ${extracted}`);
    }
  } else {
    console.log("\n  Attachments: none");
  }

  const content = buildContentString(parsed);
  console.log(`\n  Total content for LLM: ${content.length} chars`);

  if (skipLlm) {
    console.log("\n  [--parse-only] Skipping LLM extraction.");
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\n  ERROR: ANTHROPIC_API_KEY not set. Use --parse-only to skip LLM, or set the key.");
    process.exit(1);
  }

  console.log("\n  Sending to Claude for extraction...");
  const startMs = Date.now();
  const raw = await extractRawSubmissionData(content);
  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`  Claude responded in ${elapsedSec}s`);

  // Show raw keys returned by Claude
  console.log(`\n  Raw keys from Claude: [${Object.keys(raw).join(", ")}]`);

  // Display each section from the raw output (whatever keys Claude used)
  for (const [key, value] of Object.entries(raw)) {
    printSection(key, value);
  }

  // Attempt Zod validation
  console.log(`\n${DIVIDER}`);
  console.log("  Schema Validation");
  console.log(DIVIDER);

  const result = SubmissionExtractionSchema.safeParse(raw);
  if (result.success) {
    console.log("\n  ✓ Passed — Claude output matches Zod schema perfectly.");
  } else {
    console.log("\n  ✗ Validation errors (schema vs Claude output):\n");
    for (const issue of result.error.issues) {
      const pathStr = issue.path.join(".");
      console.log(`    • ${pathStr || "(root)"}: ${issue.message} (expected ${issue.code === "invalid_type" ? (issue as { expected: string }).expected : issue.code})`);
    }
    console.log("\n  These mismatches indicate the Zod schema or the prompt");
    console.log("  needs adjustment to match what Claude actually returns.");
  }

  // Always dump full raw JSON at the end
  console.log(`\n${DIVIDER}`);
  console.log("  Full Raw JSON from Claude");
  console.log(DIVIDER);
  console.log(JSON.stringify(raw, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const parseOnly = args.includes("--parse-only");
  const fileArgs = args.filter((a) => !a.startsWith("--"));

  if (fileArgs.length === 0) {
    console.log("Usage: preview.ts [--parse-only] <file-or-directory>");
    console.log("");
    console.log("  <file-or-directory>  Path to an .eml file, or a directory to scan");
    console.log("  --parse-only         Only parse the email, skip LLM extraction");
    console.log("");
    console.log("Examples:");
    console.log('  npm run preview -- "/app/emails/Saint Michael Transportation LTD - New Submission - Eff 8_19.eml"');
    console.log('  npm run preview -- --parse-only /app/emails');
    process.exit(0);
  }

  const target = path.resolve(fileArgs[0]);

  if (!fs.existsSync(target)) {
    console.error(`Not found: ${target}`);
    process.exit(1);
  }

  const stat = fs.statSync(target);
  const files = stat.isDirectory() ? collectEmlFiles(target) : [target];

  if (files.length === 0) {
    console.error("No .eml files found.");
    process.exit(1);
  }

  console.log(`Found ${files.length} .eml file(s)\n`);

  for (const file of files) {
    try {
      await previewSingle(file, parseOnly);
    } catch (err) {
      console.error(`\n  ERROR processing ${path.basename(file)}:`, err);
    }
  }

  console.log(`\n${DIVIDER}`);
  console.log("  Done.");
  console.log(DIVIDER);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
