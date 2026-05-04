"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SettingsDialogContextType {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const SettingsDialogContext = createContext<SettingsDialogContextType | null>(null);

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <SettingsDialogContext.Provider value={{ settingsOpen, setSettingsOpen }}>
      {children}
    </SettingsDialogContext.Provider>
  );
}

export function useSettingsDialog() {
  const ctx = useContext(SettingsDialogContext);
  if (!ctx) throw new Error("useSettingsDialog must be used within SettingsDialogProvider");
  return ctx;
}
