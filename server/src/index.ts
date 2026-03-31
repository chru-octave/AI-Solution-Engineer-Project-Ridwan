import express from "express";
import cors from "cors";
import path from "path";
import submissionsRouter from "./routes/submissions";
import analyticsRouter from "./routes/analytics";
import ingestRouter from "./routes/ingest";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/submissions", submissionsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/ingest", ingestRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
