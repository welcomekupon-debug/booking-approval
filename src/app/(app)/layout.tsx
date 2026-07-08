import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { AppShell } from "@/components/shell/AppShell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
