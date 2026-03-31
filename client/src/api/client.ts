import type {
  Submission,
  PaginatedResponse,
  SummaryData,
  ExposureWithSubmission,
  LossWithSubmission,
  IngestResponse,
} from "./types";

const API_BASE = "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  getSubmissions: (params?: {
    search?: string;
    lineOfBusiness?: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set("search", params.search);
    if (params?.lineOfBusiness) sp.set("lineOfBusiness", params.lineOfBusiness);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return fetchJSON<PaginatedResponse<Submission>>(
      `/submissions${qs ? `?${qs}` : ""}`,
    );
  },

  getSubmission: (id: string) =>
    fetchJSON<{ data: Submission }>(`/submissions/${id}`),

  getSummary: () => fetchJSON<{ data: SummaryData }>("/analytics/summary"),

  getExposures: () =>
    fetchJSON<{ data: ExposureWithSubmission[] }>("/analytics/exposures"),

  getLosses: () =>
    fetchJSON<{ data: LossWithSubmission[] }>("/analytics/losses"),

  triggerIngest: (emailDir?: string, mode?: "standard" | "thorough") =>
    fetchJSON<IngestResponse>("/ingest/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailDir: emailDir || "/app/emails",
        mode: mode || "standard",
      }),
    }),
};
