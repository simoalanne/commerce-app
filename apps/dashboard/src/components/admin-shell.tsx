import type { CSSProperties, ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbNavigation } from "@/components/breadcrumb-navigation";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type AdminShellProps = {
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
};

export function AdminShell({ children, onRefresh }: AdminShellProps) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader onRefresh={onRefresh ?? (() => {})} />
        <div className="px-4 py-3 lg:px-6">
          <BreadcrumbNavigation />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
