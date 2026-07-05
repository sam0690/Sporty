import { useApiQuery } from "@/hooks/api/useApiQuery";
import { AdminService, type TCeleryJobsResponse, type TKafkaJobsResponse } from "@/services/AdminService";

const POLL_INTERVAL_MS = 10_000;

export function useCeleryJobs() {
  return useApiQuery<TCeleryJobsResponse>(
    ["admin", "jobs", "celery"],
    () => AdminService.getCeleryJobs(),
    { refetchInterval: POLL_INTERVAL_MS },
  );
}

export function useKafkaJobs() {
  return useApiQuery<TKafkaJobsResponse>(
    ["admin", "jobs", "kafka"],
    () => AdminService.getKafkaJobs(),
    { refetchInterval: POLL_INTERVAL_MS },
  );
}
