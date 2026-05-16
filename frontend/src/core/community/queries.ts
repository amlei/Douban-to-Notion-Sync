import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { checkAllBindings, getAllCommunityData, startBinding, unbind as unbindApi, syncData, refreshProfile } from "./api";

export function useAllBindings() {
  return useQuery({
    queryKey: ["bindings"],
    queryFn: checkAllBindings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCommunityData() {
  return useQuery({
    queryKey: ["communityData"],
    queryFn: getAllCommunityData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => startBinding(platform),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bindings"] }),
  });
}

export function useUnbind() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => unbindApi(platform),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bindings"] });
      qc.invalidateQueries({ queryKey: ["communityData"] });
    },
  });
}

export function useSyncData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => syncData(platform),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communityData"] }),
  });
}

export function useRefreshProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => refreshProfile(platform),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bindings"] }),
  });
}
