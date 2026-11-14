import { useQuery } from "@tanstack/react-query"

import type { HealthPayload } from "../lib/health"
import { fetchJson } from "./client"

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => fetchJson<HealthPayload>("/health"),
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 1,
  })
}
