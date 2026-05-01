import { Settings, User, Database, FileText } from "lucide-react";
import { PanelModal } from "../../../components/PanelModal";
import type { PanelItem } from "../../../components/PanelModal/types";
import { useGlobalModals } from "../../modals";
import { GeneralSettings } from "../panels/GeneralSettings";
import { AccountManage } from "../panels/AccountManage";
import { DataManage } from "../panels/DataManage";
import { ServiceAgreement } from "../panels/ServiceAgreement";

const panels: PanelItem[] = [
  { id: "general", label: "通用设置", icon: Settings },
  { id: "account", label: "帐号管理", icon: User },
  { id: "data", label: "数据管理", icon: Database, fullPanel: true },
  { id: "terms", label: "服务协议", icon: FileText },
];

function renderPanel(id: string) {
  switch (id) {
    case "account": return <AccountManage />;
    case "data": return <DataManage />;
    case "terms": return <ServiceAgreement />;
    default: return <GeneralSettings />;
  }
}

export function SettingsModal() {
  const { closeSettings, activePanel, openSettings } = useGlobalModals();

  return (
    <PanelModal
      title="设置"
      panels={panels}
      activePanel={activePanel}
      onPanelChange={openSettings}
      onClose={closeSettings}
    >
      {renderPanel(activePanel)}
    </PanelModal>
  );
}
