import type { ReactNode } from "react";

import { AccountHeader } from "./AccountHeader";
import { AccountShell } from "./AccountShell";

type AccountLayoutProps = {
  children: ReactNode;
};

export default async function AccountLayout({ children }: AccountLayoutProps) {
  return (
    <div className="flex min-h-full flex-col">
      <AccountHeader />
      <AccountShell>{children}</AccountShell>
    </div>
  );
}
