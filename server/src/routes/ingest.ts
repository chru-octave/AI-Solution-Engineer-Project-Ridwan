import { Router, Request, Response } from "express";
import { ingestAllEmails } from "../services/ingestion";

const router = Router();

router.post("/trigger", async (req: Request, res: Response) => {
  try {
    const emailDir = req.body?.emailDir || "/app/emails";
    const results = await ingestAllEmails(emailDir);
    res.json({
      message: "Ingestion complete",
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
