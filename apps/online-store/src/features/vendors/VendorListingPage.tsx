import { getServerTranslations } from "@/i18n/serverTranslations";
import createServerSideApiClient from "@/server/serverApiClient";
import { getCurrentCategory, getStorefrontContext } from "@/server/storefrontContext";
import type { RouteParams } from "@/types";

import VendorListingClient from "./VendorListingClient";

import styles from "./vendorListingPage.module.css";

export default async function VendorListingPage({ params }: RouteParams) {
  const t = await getServerTranslations(params);
  const api = await createServerSideApiClient(params);
  const { body: vendors } = await api.vendors.getAll();

  const currentCategory = await getCurrentCategory(params).catch(() => null);
  const storefrontContext = await getStorefrontContext(params);
  const vendorIdsInCategory = new Set(
    storefrontContext.products
      .filter((product) => product.categoryId === currentCategory?.id)
      .map((product) => product.vendorId),
  );
  const title = currentCategory?.name ?? t("header.vendors");
  const filteredVendors = vendors.filter(
    (vendor) => !currentCategory || vendorIdsInCategory.has(vendor.id),
  );
  return (
    <main className={`${styles.page} storefrontSection`}>
      <section className={`${styles.content} storefrontRail`}>
        <div className={styles.titleRow}>
          <h1>{title}</h1>
        </div>
        <VendorListingClient vendors={filteredVendors} />
      </section>
    </main>
  );
}
