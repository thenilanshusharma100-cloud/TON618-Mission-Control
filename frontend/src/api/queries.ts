import { keepPreviousData, useQuery } from "@tanstack/react-query"

import type { HealthPayload } from "../lib/health"
import type { Mission } from "../lib/missions"
import type { Component, DesignDetail, DesignItem, DesignValidation } from "../lib/design"
import { useDebouncedValue } from "../lib/useDebouncedValue"
import { fetchJson, postJson } from "./client"

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

export function useComponents() {
  return useQuery({
    queryKey: ["components"],
    queryFn: () => fetchJson<Component[]>("/components"),
    staleTime: 60_000,
    retry: 1,
  })
}

export function useDesigns(missionSlug: string | undefined) {
  return useQuery({
    queryKey: ["designs", missionSlug],
    queryFn: () =>
      fetchJson<DesignDetail[]>(
        `/designs?mission_slug=${encodeURIComponent(missionSlug ?? "")}`,
      ),
    enabled: Boolean(missionSlug),
    staleTime: 10_000,
    retry: 1,
  })
}

export function useDesign(designId: number | null) {
  return useQuery({
    queryKey: ["design", designId],
    queryFn: () => fetchJson<DesignDetail>(`/designs/${designId}`),
    enabled: designId !== null,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useDesignValidation(
  missionSlug: string | undefined,
  items: DesignItem[],
  delayMs = 300,
) {
  const debouncedItems = useDebouncedValue(items, delayMs)
  const key = JSON.stringify(debouncedItems)
  return useQuery({
    queryKey: ["design-validation", missionSlug, key],
    queryFn: () =>
      postJson<DesignValidation>("/design/validate", {
        mission_slug: missionSlug,
        items: debouncedItems,
      }),
    enabled: Boolean(missionSlug),
    placeholderData: keepPreviousData,
    staleTime: 5_000,
    retry: false,
  })
}
