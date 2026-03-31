import { Router, Request, Response } from "express";
import { ingestAllEmails, type ExtractionMode } from "../services/ingestion";

const router = Router();

router.post("/trigger", async (req: Request, res: Response) => {
  try {
    const emailDir = req.body?.emailDir || "/app/emails";
    const mode: ExtractionMode =
      req.query.mode === "thorough" || req.body?.mode === "thorough"
        ? "thorough"
        : "standard";

    console.log(`Ingestion triggered — mode: ${mode}, dir: ${emailDir}`);
    const results = await ingestAllEmails(emailDir, mode);
    res.json({
      message: "Ingestion complete",
      mode,
      data: {
        processed: results.filter((r) => r.status === "success").length,
        failed: results.filter((r) => r.status === "error").length,
        results,
      },
    });
  } catch (err) {
    console.error("Ingestion error:", err);
    res.status(500).json({ error: "Ingestion failed" });
  }
});

export default router;
