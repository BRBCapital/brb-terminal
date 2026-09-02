"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchProxy } from "@/lib/ngx/browser";
import type { ProxyResult } from "@/lib/ngx/types";

interface UseNgxOptions {
  query?: Record<string, string | number | undefined>;
  // Price data refreshes every 20 min upstream; poll a little more often so a
  // fresh session tick shows up without the analyst reloading.
  refetchInterval?: number | false;
  enabled?: boolean;
}

export function useNgx<T>(
  path: string,
  { query, refetchInterval = false, enabled = true }: UseNgxOptions = {}
): UseQueryResult<ProxyResult<T>> {
  return useQuery({
    queryKey: ["ngx", path, query ?? {}],
    queryFn: () => fetchProxy<T>(path, query),
    refetchInterval,
    enabled,
  });
}
