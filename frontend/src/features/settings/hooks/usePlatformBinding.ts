import { useState, useRef, useCallback } from "react";
import {
  startBinding,
  unbind as unbindApi,
  refreshProfile,
  syncData,
  connectBindWs,
} from "../../../api/community";
import type { PlatformProfile, PollResult, CommunityData, BindStatus } from "../../../types/community";

const META_KEY = "community_meta";

interface PlatformMeta {
  bound: boolean;
  profile?: PlatformProfile;
  data?: CommunityData;
}

function readMeta(): Record<string, PlatformMeta> {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); }
  catch { return {}; }
}

function writeMeta(m: Record<string, PlatformMeta>) {
  localStorage.setItem(META_KEY, JSON.stringify(m));
}

function saveBinding(platform: string, bound: boolean, profile?: PlatformProfile | null) {
  const m = readMeta();
  const entry = m[platform] ?? { bound: false };
  entry.bound = bound;
  if (profile) entry.profile = profile;
  m[platform] = entry;
  writeMeta(m);
}

function removePlatform(platform: string) {
  const m = readMeta();
  delete m[platform];
  writeMeta(m);
}

export function setCommunityData(platform: string, data: CommunityData) {
  const m = readMeta();
  (m[platform] ??= { bound: false }).data = data;
  writeMeta(m);
}

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
  bindPhase: PollResult["status"];
  refreshing: boolean;
  syncing: boolean;
  syncPhase: PollResult["scrape_phase"];
  scrapePhase: PollResult["scrape_phase"];
  scrapeCounts: Record<string, number>;
  menuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  handleBind: () => Promise<void>;
  handleUnbind: () => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleSync: () => Promise<void>;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  checkInitial: () => CommunityData | null;
  initFromApi: (status: BindStatus, data: CommunityData) => void;
}

export function usePlatformBinding(
  platform: string,
  wsRef: React.MutableRefObject<WebSocket | null>,
  callbacks: PlatformBindingCallbacks,
): PlatformBindingState {
  const [bound, setBound] = useState(false);
  const [profile, setProfile] = useState<PlatformProfile | null>(null);
  const [binding, setBinding] = useState(false);
  const [bindPhase, setBindPhase] = useState<PollResult["status"]>("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<PollResult["scrape_phase"]>(undefined);
  const [scrapePhase, setScrapePhase] = useState<PollResult["scrape_phase"]>(undefined);
  const [scrapeCounts, setScrapeCounts] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const checkInitial = useCallback((): CommunityData | null => {
    const pm = readMeta()[platform];
    if (pm?.bound) {
      setBound(true);
      setProfile(pm.profile ?? null);
      return pm.data ?? null;
    }
    return null;
  }, [platform]);

  const handleBind = async () => {
    setBinding(true);
    callbacks.onError(null);
    callbacks.onQr(null);
    try {
      await startBinding(platform);
      wsRef.current = connectBindWs(platform, {
        onQr: (base64) => callbacks.onQr(`data:image/png;base64,${base64}`),
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
          saveBinding(platform, true, p);
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

  const handleUnbind = async () => {
    await unbindApi(platform);
    setBound(false);
    setProfile(null);
    setScrapeCounts({});
    removePlatform(platform);
    if (callbacks.onUnbind) callbacks.onUnbind();
  };

  const handleRefresh = async () => {
    setMenuOpen(false);
    setRefreshing(true);
    try {
      const data = await refreshProfile(platform);
      if (data.profile) {
        setProfile(data.profile);
        saveBinding(platform, true, data.profile);
      }
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  const handleSync = async () => {
    setMenuOpen(false);
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
        onBound: async (_userId, p, counts) => {
          setScrapeCounts(counts);
          setSyncing(false);
          saveBinding(platform, true, p);
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

  const initFromApi = useCallback((status: BindStatus, data: CommunityData) => {
    if (status.bound) {
      setBound(true);
      setProfile(status.profile ?? null);
      saveBinding(platform, true, status.profile);
      setCommunityData(platform, data);
    }
  }, [platform]);

  return {
    bound, profile, binding, bindPhase, refreshing, syncing,
    syncPhase, scrapePhase, scrapeCounts, menuOpen, menuRef,
    handleBind, handleUnbind, handleRefresh, handleSync, setMenuOpen,
    checkInitial, initFromApi,
  };
}
