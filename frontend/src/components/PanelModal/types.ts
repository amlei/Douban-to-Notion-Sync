import type { LucideIcon } from "lucide-react";

export interface PanelItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** When true, clicking this panel hides the sidebar and renders the panel fullscreen with a back button. */
  fullPanel?: boolean;
}
