"use client";

import { QueryClientProvider } from "@/components/query-client-provider";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SettingsDialogProvider, useSettingsDialog } from "@/core/settings/settings-dialog-context";
import { SettingsDialog } from "@/components/workspace/settings/settings-dialog";
import { AuthGuardProvider } from "@/core/auth/auth-guard";

export function WorkspaceContent({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider>
      <AuthGuardProvider>
        <SidebarProvider>
          <SettingsDialogProvider>
            <WorkspaceSidebar />
            <SidebarInset>{children}</SidebarInset>
            <SettingsDialogConsumer />
          </SettingsDialogProvider>
        </SidebarProvider>
      </AuthGuardProvider>
    </QueryClientProvider>
  );
}

function SettingsDialogConsumer() {
  const { settingsOpen, setSettingsOpen } = useSettingsDialog();
  return <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />;
}
