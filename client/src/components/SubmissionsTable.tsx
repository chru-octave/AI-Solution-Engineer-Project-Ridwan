import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSubmissions } from "../api/hooks";
import SourceBadge from "./SourceBadge";

export default function SubmissionsTable() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, error } = useSubmissions({
    search: search || undefined,
    page,
    limit,
  });

  const submissions = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-dark-border">
        <h2 className="font-display text-lg text-light">All Email Submissions</h2>
        <input
          type="text"
          placeholder="Search insured, broker, subject..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="bg-dark-bg border border-dark-border rounded-md text-light px-3 py-2 text-sm w-72 outline-none focus:border-gold transition-colors placeholder:text-muted font-body"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-dark-hover">
              {["Source", "Insured / File", "Broker", "State", "Lines of Business", "Fleet", "Losses", "Date"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-muted font-medium border-b border-dark-border"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="text-center py-16 text-muted text-sm">
                  Loading submissions...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={8} className="text-center py-16 text-danger text-sm">
                  Failed to load: {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && !isError && submissions.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-16 text-muted text-sm">
                  No submissions found
                </td>
              </tr>
            )}
            {submissions.map((s) => {
              const displayName =
                s.insured?.companyName || s.emailSubject || s.sourceFile;
              const lossCount = s.losses?.length || 0;
              return (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/submissions/${s.id}`)}
                  className="cursor-pointer hover:bg-dark-hover transition-colors border-b border-dark-border"
                >
                  <td className="px-4 py-3">
                    <SourceBadge sourceFile={s.sourceFile} />
                  </td>
                  <td className="px-4 py-3 text-sm text-light max-w-[200px] truncate">
                    {displayName}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {s.broker?.companyName || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {s.insured?.state || "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.linesOfBusiness?.length ? (
                        s.linesOfBusiness.map((l) => (
                          <span
                            key={l.id}
                            className="bg-dark-bg border border-dark-border rounded px-2 py-0.5 text-[0.65rem] text-sky whitespace-nowrap"
                          >
                            {l.type}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted text-sm">&mdash;</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {s.exposures?.numberOfTrucks ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {lossCount > 0
                      ? `${lossCount} record${lossCount > 1 ? "s" : ""}`
                      : "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">
                    {s.emailDate
                      ? new Date(s.emailDate).toLocaleDateString()
                      : "\u2014"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border">
          <p className="text-xs text-muted">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded text-xs bg-dark-hover text-muted border border-dark-border disabled:opacity-30 hover:text-light transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                    n === pagination.page
                      ? "bg-gold/20 text-gold border-gold/40"
                      : "bg-dark-hover text-muted border-dark-border hover:text-light"
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded text-xs bg-dark-hover text-muted border border-dark-border disabled:opacity-30 hover:text-light transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
