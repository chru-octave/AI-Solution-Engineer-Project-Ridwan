import * as path from "path";
import { ingestAllEmails } from "../services/ingestion";

async function main() {
  const emailDir =
    process.argv[2] || path.resolve(__dirname, "../../../Emails Round");

  console.log(`Starting ingestion from: ${emailDir}`);
  const results = await ingestAllEmails(emailDir);

  const success = results.filter((r) => r.status === "success").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(`\nIngestion complete:`);
  console.log(`  Processed: ${success}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFailed files:");
    results
      .filter((r) => r.status === "error")
      .forEach((r) => console.log(`  - ${r.file}: ${r.error}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal ingestion error:", err);
  process.exit(1);
});
