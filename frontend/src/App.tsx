import { useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { PanelRightOpen } from "lucide-react";
import { useChatStore } from "./hooks/useChatStore";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { GlobalModalsProvider } from "./features/modals";
import { Sidebar } from "./components/Sidebar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ChatPanel } from "./components/ChatPanel";
import "./App.css";

function AppInner() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showExpandBtn, setShowExpandBtn] = useState(false);
  const store = useChatStore();

  const handleWelcomeSend = (text: string) => {
    const id = store.createChat();
    store.updateTitle(id, text.slice(0, 30));
  };

  const handleCollapse = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleExpand = useCallback(() => {
    setShowExpandBtn(false);
    setSidebarOpen(true);
  }, []);

  const handleTransitionEnd = useCallback(() => {
    if (!sidebarOpen) {
      setShowExpandBtn(true);
    }
  }, [sidebarOpen]);

  return (
    <div className="layout">
      <Sidebar
        open={sidebarOpen}
        chats={store.chats}
        activeChatId={store.activeChatId}
        user={user}
        onToggle={handleCollapse}
        onSelectChat={store.switchChat}
        onNewChat={() => store.switchChat(null)}
        onLogout={logout}
        onTransitionEnd={handleTransitionEnd}
      />

      <main className="center">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <div className="center-header">
                  <button
                    className={`sidebar-toggle ${showExpandBtn ? "visible" : ""}`}
                    onClick={handleExpand}
                  >
                    <PanelRightOpen size={16} />
                  </button>
                </div>
                <div className="chat-area">
                  {store.activeChatId ? (
                    <ChatPanel chatId={store.activeChatId} store={store} />
                  ) : (
                    <WelcomeScreen onSend={handleWelcomeSend} />
                  )}
                </div>
              </>
            }
          />
          <Route path="/data" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <aside className="right-panel" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GlobalModalsProvider>
        <AppInner />
      </GlobalModalsProvider>
    </AuthProvider>
  );
}
