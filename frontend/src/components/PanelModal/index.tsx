import { X, ArrowLeft } from "lucide-react";
import "./modal-base.css";
import "./PanelModal.css";
import type { PanelItem } from "./types";

interface PanelModalProps {
  title: string;
  panels: PanelItem[];
  activePanel: string;
  onPanelChange: (id: string) => void;
  onClose: () => void;
  children: React.ReactNode;
}

export function PanelModal({ title, panels, activePanel, onPanelChange, onClose, children }: PanelModalProps) {
  const current = panels.find((p) => p.id === activePanel);
  const isFullPanel = current?.fullPanel === true;

  // Back button returns to the first non-fullPanel entry
  const homeId = panels.find((p) => !p.fullPanel)?.id ?? panels[0]?.id;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal panel-modal" onClick={(e) => e.stopPropagation()}>
        {isFullPanel ? (
          <>
            <div className="modal-header">
              <button
                className="panel-modal-back"
                onClick={() => onPanelChange(homeId)}
                title={`返回${title}`}
              >
                <ArrowLeft size={18} />
              </button>
              <h2>{current!.label}</h2>
              <button className="modal-close" onClick={onClose}>
                <X size={22} />
              </button>
            </div>
            <div className="panel-modal-full">
              {children}
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <h2>{title}</h2>
              <button className="modal-close" onClick={onClose}>
                <X size={22} />
              </button>
            </div>
            <div className="panel-modal-layout">
              <nav className="panel-modal-tabs">
                {panels.map((panel) => {
                  const Icon = panel.icon;
                  return (
                    <button
                      key={panel.id}
                      className={`panel-modal-tab ${activePanel === panel.id ? "active" : ""}`}
                      onClick={() => onPanelChange(panel.id)}
                    >
                      <Icon size={20} />
                      <span>{panel.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="panel-modal-content">
                {children}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
