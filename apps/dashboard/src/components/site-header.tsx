import { useClerk } from "@clerk/react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

import { SidebarTrigger } from "./ui/sidebar";

type SiteHeaderProps = {
  onRefresh: () => void | Promise<void>;
};

export function SiteHeader({ onRefresh }: SiteHeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useClerk();

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
