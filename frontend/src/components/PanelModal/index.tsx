import { X, ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button";
import { ScrollArea } from "../ui/ScrollArea";
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

  // Back button returns to returnTo if set, otherwise the first non-fullPanel entry
  const homeId = current?.returnTo ?? panels.find((p) => !p.fullPanel)?.id ?? panels[0]?.id;
  const visiblePanels = panels.filter((p) => !p.hidden);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal panel-modal" onClick={(e) => e.stopPropagation()}>
        {isFullPanel ? (
          <>
            <div className="modal-header">
              <div className="modal-header-left">
                <Button
                  icon={<ArrowLeft size={18} />}
                  onClick={() => onPanelChange(homeId)}
                  title={`返回${title}`}
                />
                <h2>{current!.label}</h2>
              </div>
              <Button icon={<X size={22} />} onClick={onClose} />
            </div>
            <ScrollArea className="panel-modal-full">
              {children}
            </ScrollArea>
          </>
        ) : (
          <>
            <div className="modal-header">
              <h2>{title}</h2>
              <Button icon={<X size={22} />} onClick={onClose} />
            </div>
            <div className="panel-modal-layout">
              <nav className="panel-modal-tabs">
                {visiblePanels.map((panel) => {
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
              <ScrollArea className="panel-modal-content">
                {children}
              </ScrollArea>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
