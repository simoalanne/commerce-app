import type React from "react";

import Footer from "@/components/layout/Footer";
import type { RouteParams } from "@/types";

import styles from "../LocaleLayout.module.css";

type StorefrontLayoutProps = RouteParams & {
  children: React.ReactNode;
};

export default async function StorefrontLayout({ children, params }: StorefrontLayoutProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>{children}</div>
      <Footer params={params} />
    </div>
  );
}
