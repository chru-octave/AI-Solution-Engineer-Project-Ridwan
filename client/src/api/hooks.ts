import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export function useSubmissions(
  params?: Parameters<typeof api.getSubmissions>[0],
) {
  return useQuery({
    queryKey: ["submissions", params],
    queryFn: () => api.getSubmissions(params),
  });
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: ["submission", id],
    queryFn: () => api.getSubmission(id),
    enabled: !!id,
  });
}

export function useSummary() {
  return useQuery({
    queryKey: ["summary"],
    queryFn: () => api.getSummary(),
  });
}

export function useExposures() {
  return useQuery({
    queryKey: ["exposures"],
    queryFn: () => api.getExposures(),
  });
}

export function useLosses() {
  return useQuery({
    queryKey: ["losses"],
    queryFn: () => api.getLosses(),
  });
}

export function useIngest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      emailDir,
      mode,
    }: {
      emailDir?: string;
      mode?: "standard" | "thorough";
    }) => api.triggerIngest(emailDir, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["exposures"] });
      queryClient.invalidateQueries({ queryKey: ["losses"] });
    },
  });
}
