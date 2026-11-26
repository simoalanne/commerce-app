import type { ReactNode } from "react";

import AccountLayoutContent from "@/features/account/AccountLayout";

export { generateAccountAreaMetadata as generateMetadata } from "@/metadata/noIndexMetadata";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountLayoutContent>{children}</AccountLayoutContent>;
}
