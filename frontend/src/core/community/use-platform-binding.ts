"use client";

import { useState, useCallback } from "react";
import { startBinding, startBindingWithApiKey, unbind as unbindApi, refreshProfile, syncData, connectBindWs } from "./api";
import type { PlatformProfile, PollResult, BindStatus } from "./types";
import { useQueryClient } from "@tanstack/react-query";

export interface PlatformBindingCallbacks {
  onQr: (src: string | null) => void;
  onError: (err: string | null) => void;
  onBindComplete?: () => void;
  onUnbind?: () => void;
}

export interface PlatformBindingState {
  bound: boolean;
  profile: PlatformProfile | null;
  binding: boolean;
  validating: boolean;
  bindPhase: PollResult["status"];
  refreshing: boolean;
  syncing: boolean;
  syncPhase: PollResult["scrape_phase"];
  scrapePhase: PollResult["scrape_phase"];
  scrapeCounts: Record<string, number>;
  handleBind: () => Promise<void>;
  handleBindWithApiKey: (apiKey: string) => Promise<void>;
  handleUnbind: () => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleSync: () => Promise<void>;
  initFromApi: (status: BindStatus) => void;
}

export function usePlatformBinding(
  platform: string,
  wsRef: React.RefObject<WebSocket | null>,
  callbacks: PlatformBindingCallbacks,
): PlatformBindingState {
  const qc = useQueryClient();
  const [bound, setBound] = useState(false);
  const [profile, setProfile] = useState<PlatformProfile | null>(null);
  const [binding, setBinding] = useState(false);
  const [validating, setValidating] = useState(false);
  const [bindPhase, setBindPhase] = useState<PollResult["status"]>("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<PollResult["scrape_phase"]>(undefined);
  const [scrapePhase, setScrapePhase] = useState<PollResult["scrape_phase"]>(undefined);
  const [scrapeCounts, setScrapeCounts] = useState<Record<string, number>>({});

  const handleBind = async () => {
    setBinding(true);
    callbacks.onError(null);
    callbacks.onQr(null);
    try {
      await startBinding(platform);
      wsRef.current = connectBindWs(platform, {
        onQr: (base64) => callbacks.onQr(base64),
        onStatus: (status) => {
          setBindPhase(status);
          if (status === "scanned") callbacks.onQr(null);
        },
        onScraping: (phase, counts) => {
          setScrapePhase(phase);
          setScrapeCounts(counts);
        },
        onBound: (_userId, p, counts) => {
          setBound(true);
          setProfile(p ?? null);
          setScrapeCounts(counts);
          setBinding(false);
          callbacks.onQr(null);
          qc.invalidateQueries({ queryKey: ["bindings"] });
          qc.invalidateQueries({ queryKey: ["communityData", "infinite"] });
          if (callbacks.onBindComplete) callbacks.onBindComplete();
        },
        onFailed: (error) => {
          callbacks.onError(error);
          setBinding(false);
          callbacks.onQr(null);
        },
      });
    } catch {
      callbacks.onError("启动绑定失败");
      setBinding(false);
    }
  };

  const handleBindWithApiKey = async (apiKey: string) => {
    setValidating(true);
    callbacks.onError(null);
    try {
      await startBindingWithApiKey(platform, apiKey);
      wsRef.current = connectBindWs(platform, {
        onQr: () => {},
        onStatus: (status) => {
          setBindPhase(status);
        },
        onScraping: (phase, counts) => {
          setScrapePhase(phase);
          setScrapeCounts(counts);
        },
        onBound: (_userId, p, counts) => {
          setBound(true);
          setProfile(p ?? null);
          setScrapeCounts(counts);
          setValidating(false);
          qc.invalidateQueries({ queryKey: ["bindings"] });
          qc.invalidateQueries({ queryKey: ["communityData", "infinite"] });
          if (callbacks.onBindComplete) callbacks.onBindComplete();
        },
        onFailed: (error) => {
          callbacks.onError(error);
          setValidating(false);
        },
      });
    } catch {
      callbacks.onError("启动绑定失败");
      setValidating(false);
    }
  };

  const handleUnbind = async () => {
    await unbindApi(platform);
    setBound(false);
    setProfile(null);
    setScrapeCounts({});
    qc.invalidateQueries({ queryKey: ["bindings"] });
    qc.invalidateQueries({ queryKey: ["communityData", "infinite"] });
    if (callbacks.onUnbind) callbacks.onUnbind();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await refreshProfile(platform);
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncPhase(undefined);
    try {
      await syncData(platform);
      wsRef.current = connectBindWs(platform, {
        onQr: () => {},
        onStatus: () => {},
        onScraping: (phase, counts) => {
          setSyncPhase(phase);
          setScrapeCounts(counts);
        },
        onBound: async (_userId, _p, counts) => {
          setScrapeCounts(counts);
          setSyncing(false);
          qc.invalidateQueries({ queryKey: ["bindings"] });
          qc.invalidateQueries({ queryKey: ["communityData", "infinite"] });
          if (callbacks.onBindComplete) callbacks.onBindComplete();
        },
        onFailed: () => {
          setSyncing(false);
        },
      });
    } catch {
      setSyncing(false);
    }
  };

  const initFromApi = useCallback((status: BindStatus) => {
    if (status.bound) {
      setBound(true);
      setProfile(status.profile ?? null);
    }
  }, []);

  return {
    bound, profile, binding, validating, bindPhase, refreshing, syncing,
    syncPhase, scrapePhase, scrapeCounts,
    handleBind, handleBindWithApiKey, handleUnbind, handleRefresh, handleSync,
    initFromApi,
  };
}
