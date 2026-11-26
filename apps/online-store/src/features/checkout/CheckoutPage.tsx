import ListOfProducts from "@/components/homePage.tsx/ListOfProducts";
import { getServerTranslations } from "@/i18n/serverTranslations";
import type { RouteParams } from "@/types";

import { CheckoutPageClient } from "./CheckoutPageClient";
import { getCheckoutServerState } from "./getCheckoutServerState";

import styles from "./CheckoutPage.module.css";

export async function CheckoutPage({ params }: RouteParams) {
  const { locale } = await params;
  const { cart, cartUpdatedAt, cartItems, cartAdjustmentNotice, products } =
    await getCheckoutServerState({
      locale,
      params,
    });
  const t = await getServerTranslations(params, "checkout");
  const recommendedProducts = products
    .filter((product) => !product.isOutOfStock)
    .toSorted((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
    .slice(0, 10);

  return (
    <main className={styles.page}>
      <div className={styles.pageShell}>
        <CheckoutPageClient
          initialCart={cart}
          initialCartUpdatedAt={cartUpdatedAt}
          initialCartItems={cartItems}
          availableProducts={products}
          cartAdjustmentNotice={cartAdjustmentNotice}
          emptyTitle={t("emptyTitle")}
          emptyContinueLabel={t("emptyContinueShopping")}
        />
        {recommendedProducts.length > 0 ? (
          <section className={styles.suggestionsSection}>
            <header className={styles.suggestionsHeader}>
              <h2 className={styles.suggestionsTitle}>{t("productRecommendationsTitle")}</h2>
            </header>
            <ListOfProducts products={recommendedProducts} layout="carousel" />
          </section>
        ) : null}
      </div>
    </main>
  );
}
