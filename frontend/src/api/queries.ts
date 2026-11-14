import { useQuery } from "@tanstack/react-query"

import type { HealthPayload } from "../lib/health"
import type { Mission } from "../lib/missions"
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

export function useMissions() {
  return useQuery({
    queryKey: ["missions"],
    queryFn: () => fetchJson<Mission[]>("/missions"),
    staleTime: 60_000,
    retry: 1,
  })
}
