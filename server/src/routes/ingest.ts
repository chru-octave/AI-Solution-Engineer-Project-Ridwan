import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ingestAllEmails, type ExtractionMode } from "../services/ingestion";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".eml" || ext === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Only .eml and .pdf are allowed.`));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

router.post("/upload", upload.array("files", 50), (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  const uploaded = files.map((f) => ({
    filename: f.originalname,
    size: f.size,
  }));

  console.log(`Uploaded ${uploaded.length} file(s) to ${UPLOAD_DIR}`);
  res.json({ uploaded, uploadDir: UPLOAD_DIR });
});

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
