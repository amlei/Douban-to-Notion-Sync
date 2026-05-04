import { Settings, User, Database, FileText, RefreshCw, BookOpen } from "lucide-react";
import { PanelModal } from "@/components/PanelModal";
import type { PanelItem } from "@/components/PanelModal/types";
import { useGlobalModals } from "../../modals";
import { GeneralSettings } from "../panels/GeneralSettings";
import { AccountManage } from "../panels/AccountManage";
import { DataManage } from "../panels/DataManage";
import { SyncManage } from "../panels/SyncManage";
import "../components/Collection/Collection.css";
import { Collection } from "../components/Collection";
import { useCommunityData } from "../hooks/useCommunityData";
import { ServiceAgreement } from "../panels/ServiceAgreement";

const panels: PanelItem[] = [
  { id: "general", label: "通用设置", icon: Settings },
  { id: "account", label: "帐号管理", icon: User },
  { id: "data", label: "数据管理", icon: Database },
  { id: "sync", label: "同步数据", icon: RefreshCw, fullPanel: true, hidden: true, returnTo: "data" },
  { id: "data-view", label: "查看数据", icon: BookOpen, fullPanel: true, hidden: true, returnTo: "data" },
  { id: "terms", label: "服务协议", icon: FileText },
];

function renderPanel(id: string, communityData: ReturnType<typeof useCommunityData>) {
  switch (id) {
    case "account": return <AccountManage />;
    case "data": return <DataManage />;
    case "sync": return <SyncManage />;
    case "data-view":
      return (
        <Collection
          doubanBound={communityData.doubanBinding.bound}
          wereadBound={communityData.wereadBinding.bound}
          flomoBound={communityData.flomoBinding.bound}
          books={communityData.books}
          wereadBooks={communityData.wereadBooks}
          movies={communityData.movies}
          notes={communityData.notes}
          wereadBookmarks={communityData.wereadBookmarks}
          flomoMemos={communityData.flomoMemos}
        />
      );
    case "terms": return <ServiceAgreement />;
    default: return <GeneralSettings />;
  }
}

export function SettingsModal() {
  const { closeSettings, activePanel, openSettings } = useGlobalModals();
  const communityData = useCommunityData();

  return (
    <PanelModal
      title="设置"
      panels={panels}
      activePanel={activePanel}
      onPanelChange={openSettings}
      onClose={closeSettings}
    >
      {renderPanel(activePanel, communityData)}
    </PanelModal>
  );
}
