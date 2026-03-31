import { useState } from "react";
import { useIngest } from "../api/hooks";
import type { IngestResult } from "../api/types";

export default function IngestPage() {
  const [emailDir, setEmailDir] = useState("/app/emails");
  const [mode, setMode] = useState<"standard" | "thorough">("standard");
  const ingest = useIngest();

  const handleTrigger = () => {
    ingest.mutate({ emailDir, mode });
  };

  const results: IngestResult[] = ingest.data?.data?.results ?? [];
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl text-gold">Ingest Emails</h1>
        <p className="text-sm text-muted mt-1">
          Trigger ingestion of .eml and .pdf files from a directory
        </p>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-lg p-6 space-y-5">
        <div>
          <label className="block text-[0.7rem] uppercase tracking-widest text-muted mb-2 font-semibold">
            Email Directory
          </label>
          <input
            type="text"
            value={emailDir}
            onChange={(e) => setEmailDir(e.target.value)}
            className="w-full bg-dark-bg border border-dark-border rounded-md text-light px-3 py-2.5 text-sm outline-none focus:border-gold transition-colors font-body"
          />
          <p className="text-xs text-muted mt-1">
            Path inside the Docker container (default: /app/emails)
          </p>
        </div>

        <div>
          <label className="block text-[0.7rem] uppercase tracking-widest text-muted mb-2 font-semibold">
            Extraction Mode
          </label>
          <div className="flex gap-3">
            {(["standard", "thorough"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  mode === m
                    ? "bg-gold/15 text-gold border-gold/40"
                    : "bg-dark-bg text-muted border-dark-border hover:text-light"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-1">
            Thorough mode uses a second LLM pass to merge multi-section
            extractions
          </p>
        </div>

        <button
          onClick={handleTrigger}
          disabled={ingest.isPending}
          className="bg-gold text-dark-bg font-semibold px-6 py-2.5 rounded-md text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ingest.isPending ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Running Ingestion...
            </span>
          ) : (
            "Trigger Ingestion"
          )}
        </button>
      </div>

      {ingest.isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
          <p className="text-sm text-danger">
            Ingestion failed: {(ingest.error as Error).message}
          </p>
        </div>
      )}

      {ingest.isSuccess && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 flex-1">
              <p className="text-2xl font-display text-success">
                {successCount}
              </p>
              <p className="text-xs text-success/80 mt-0.5">Processed</p>
            </div>
            <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 flex-1">
              <p className="text-2xl font-display text-danger">{errorCount}</p>
              <p className="text-xs text-danger/80 mt-0.5">Failed</p>
            </div>
            <div className="bg-sky/10 border border-sky/30 rounded-lg px-4 py-3 flex-1">
              <p className="text-2xl font-display text-sky">{skippedCount}</p>
              <p className="text-xs text-sky/80 mt-0.5">Skipped</p>
            </div>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-border">
              <h3 className="font-display text-sm text-light">
                Ingestion Results
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-hover text-left text-[0.7rem] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t border-dark-border">
                    <td className="px-4 py-2.5 text-light">{r.file}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${
                          r.status === "success"
                            ? "bg-success/10 text-success"
                            : r.status === "error"
                              ? "bg-danger/10 text-danger"
                              : "bg-sky/10 text-sky"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted text-xs">
                      {r.error || r.submissionId || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
