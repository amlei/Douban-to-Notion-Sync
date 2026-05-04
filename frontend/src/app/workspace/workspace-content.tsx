"use client";

import { QueryClientProvider } from "@/components/query-client-provider";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SettingsDialogProvider, useSettingsDialog } from "@/components/workspace/use-settings-dialog";
import { SettingsDialog } from "@/components/workspace/settings/settings-dialog";

export function WorkspaceContent({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider>
      <SidebarProvider>
        <SettingsDialogProvider>
          <WorkspaceSidebar />
          <SidebarInset>{children}</SidebarInset>
          <SettingsDialogConsumer />
        </SettingsDialogProvider>
      </SidebarProvider>
    </QueryClientProvider>
  );
}

function SettingsDialogConsumer() {
  const { settingsOpen, setSettingsOpen } = useSettingsDialog();
  return <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />;
}
