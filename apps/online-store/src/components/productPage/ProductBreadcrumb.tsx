import { Link } from "@/i18n/navigation";
import { getServerTranslations } from "@/i18n/serverTranslations";
import type { DestructuredRouteParams } from "@/types";
import type { StorefrontContext } from "@/types/api";

import styles from "./ProductBreadcrumb.module.css";

type ProductBreadcrumbProps = {
  storefrontContext: StorefrontContext;
  params: DestructuredRouteParams;
  productId: number;
  productName: string;
};

export default async function ProductBreadcrumb({
  storefrontContext,
  params,
  productId,
  productName,
}: ProductBreadcrumbProps) {
  const t = await getServerTranslations(params);
  const product = storefrontContext.products.find((item) => item.id === productId);
  const vendor = storefrontContext.vendors.find((item) => item.id === product?.vendorId);

  return (
    <nav className={styles.breadcrumb} aria-label={t("productBreadcrumb.ariaLabel")}>
      <Link href="/products" className={styles.link}>
        {t("header.products")}
      </Link>
      <span className={styles.separator}>/</span>
      <Link href={`/vendors/${vendor?.slug}`} className={styles.link}>
        {vendor?.name}
      </Link>
      <span className={styles.separator}>/</span>
      <span className={styles.current} aria-current="page">
        {productName}
      </span>
    </nav>
  );
}
