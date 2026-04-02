import { useState, useRef, useCallback } from "react";
import { useIngest, useUpload } from "../api/hooks";
import type { IngestResult } from "../api/types";

const ACCEPTED_EXTENSIONS = [".eml", ".pdf"];

function isValidFile(file: File) {
  return ACCEPTED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IngestPage() {
  const [emailDir, setEmailDir] = useState("/app/emails");
  const [mode, setMode] = useState<"standard" | "thorough">("standard");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useUpload();
  const ingest = useIngest();

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(isValidFile);
    if (valid.length === 0) return;
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !existing.has(f.name))];
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    const result = await upload.mutateAsync(selectedFiles);
    setEmailDir(result.uploadDir);
    setSelectedFiles([]);
  };

  const handleUploadAndIngest = async () => {
    if (selectedFiles.length === 0) return;
    const result = await upload.mutateAsync(selectedFiles);
    setEmailDir(result.uploadDir);
    setSelectedFiles([]);
    ingest.mutate({ emailDir: result.uploadDir, mode });
  };

  const removeFile = (name: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const results: IngestResult[] = ingest.data?.data?.results ?? [];
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  const isWorking = upload.isPending || ingest.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl text-gold">Ingest Emails</h1>
        <p className="text-sm text-muted mt-1">
          Upload .eml and .pdf files or trigger ingestion from a directory
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 space-y-4">
        <label className="block text-[0.7rem] uppercase tracking-widest text-muted font-semibold">
          Upload Files
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-gold bg-gold/5"
              : "border-dark-border hover:border-muted"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".eml,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <svg
            className="w-10 h-10 mx-auto text-muted mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.438 3.142A4.5 4.5 0 0118 19.5H6.75z"
            />
          </svg>
          <p className="text-sm text-muted">
            Drag & drop <span className="text-light">.eml</span> or{" "}
            <span className="text-light">.pdf</span> files here, or{" "}
            <span className="text-gold">click to browse</span>
          </p>
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}{" "}
              selected
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {selectedFiles.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between bg-dark-bg rounded px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded ${
                        f.name.toLowerCase().endsWith(".eml")
                          ? "bg-sky/10 text-sky"
                          : "bg-violet/10 text-violet"
                      }`}
                    >
                      {f.name.split(".").pop()}
                    </span>
                    <span className="text-light truncate">{f.name}</span>
                    <span className="text-muted text-xs flex-shrink-0">
                      {formatSize(f.size)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(f.name);
                    }}
                    className="text-muted hover:text-danger text-xs ml-2 flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleUploadAndIngest}
                disabled={isWorking}
                className="bg-gold text-dark-bg font-semibold px-5 py-2 rounded-md text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {upload.isPending
                  ? "Uploading..."
                  : ingest.isPending
                    ? "Ingesting..."
                    : "Upload & Ingest"}
              </button>
              <button
                onClick={handleUpload}
                disabled={isWorking}
                className="bg-dark-hover text-muted font-medium px-5 py-2 rounded-md text-sm border border-dark-border hover:text-light transition-colors disabled:opacity-50"
              >
                Upload Only
              </button>
            </div>
          </div>
        )}

        {upload.isError && (
          <p className="text-sm text-danger">
            Upload failed: {(upload.error as Error).message}
          </p>
        )}
      </div>

      {/* Manual Trigger */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 space-y-5">
        <p className="text-[0.7rem] uppercase tracking-widest text-muted font-semibold">
          Or Ingest from Directory
        </p>

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
          onClick={() => ingest.mutate({ emailDir, mode })}
          disabled={isWorking}
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

      {/* Error */}
      {ingest.isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
          <p className="text-sm text-danger">
            Ingestion failed: {(ingest.error as Error).message}
          </p>
        </div>
      )}

      {/* Results */}
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
