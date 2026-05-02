import { ChevronRight, RefreshCw, BookOpen } from "lucide-react";
import { useGlobalModals } from "../../../modals";
import "./DataManage.css";

export function DataManage() {
  const { openSettings } = useGlobalModals();

  return (
    <div className="panel-modal-page">
      <div className="settings-kv-list">
        <button className="settings-kv-row settings-kv-row-clickable" onClick={() => openSettings("sync")}>
          <div className="settings-kv-row-left">
            <RefreshCw size={16} className="settings-kv-icon" />
            <div>
              <span className="settings-kv-row-label">同步数据</span>
              <span className="settings-kv-row-desc">绑定第三方平台，同步书影音数据</span>
            </div>
          </div>
          <ChevronRight size={16} className="settings-kv-arrow" />
        </button>
        <button className="settings-kv-row settings-kv-row-clickable" onClick={() => openSettings("data-view")}>
          <div className="settings-kv-row-left">
            <BookOpen size={16} className="settings-kv-icon" />
            <div>
              <span className="settings-kv-row-label">查看数据</span>
              <span className="settings-kv-row-desc">浏览已同步的图书、电影、笔记等</span>
            </div>
          </div>
          <ChevronRight size={16} className="settings-kv-arrow" />
        </button>
      </div>
    </div>
  );
}
