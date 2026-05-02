import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { LoginModal } from "./auth/LoginModal";
import { SettingsModal } from "./settings/SettingsModal";

interface GlobalModalsState {
  loginVisible: boolean;
  settingsVisible: boolean;
  activePanel: string;
  openLogin: () => void;
  closeLogin: () => void;
  openSettings: (panel?: string) => void;
  closeSettings: () => void;
}

const GlobalModalsContext = createContext<GlobalModalsState | null>(null);

export function useGlobalModals(): GlobalModalsState {
  const ctx = useContext(GlobalModalsContext);
  if (!ctx) throw new Error("useGlobalModals must be used within GlobalModalsProvider");
  return ctx;
}

export function GlobalModalsProvider({ children }: { children: ReactNode }) {
  const [loginVisible, setLoginVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activePanel, setActivePanel] = useState("general");

  const openLogin = useCallback(() => setLoginVisible(true), []);
  const closeLogin = useCallback(() => setLoginVisible(false), []);
  const openSettings = useCallback((panel?: string) => {
    if (panel) setActivePanel(panel);
    setSettingsVisible(true);
  }, []);
  const closeSettings = useCallback(() => setSettingsVisible(false), []);

  return (
    <GlobalModalsContext.Provider
      value={{ loginVisible, settingsVisible, activePanel, openLogin, closeLogin, openSettings, closeSettings }}
    >
      {children}
      {loginVisible && <LoginModal />}
      {settingsVisible && <SettingsModal />}
    </GlobalModalsContext.Provider>
  );
}
