import { useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import type { ProductSummary } from "@/types/api";
import { readableTextColor } from "@/utils/tagColor";

import { CheckoutCartItemControls } from "./CheckoutCartItemControls";

import styles from "./CheckoutPage.module.css";

type CheckoutCartItemRowProps = {
  product: ProductSummary;
  quantity: number;
  formattedUnitPrice: string;
  formattedLineTotal: string;
};

export function CheckoutCartItemRow({
  product,
  quantity,
  formattedUnitPrice,
  formattedLineTotal,
}: CheckoutCartItemRowProps) {
  const t = useTranslations("checkout");
  const productHref = `/products/${product.slug}`;

  return (
    <article className={styles.itemRow}>
      <div className={styles.itemMedia}>
        {product.imageUrl ? (
          productHref ? (
            <Link href={productHref} aria-label={product.name}>
              <div className={styles.imageWrapper}>
                <Image
                  className={styles.itemImage}
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="6rem"
                />
              </div>
            </Link>
          ) : (
            <div className={styles.imageWrapper}>
              <Image
                className={styles.itemImage}
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="6rem"
              />
            </div>
          )
        ) : (
          <div className={styles.itemImageFallback}>{product.name.slice(0, 1)}</div>
        )}
      </div>

      <div className={styles.itemBody}>
        <div className={styles.itemText}>
          {product.tags[0] ? (
            <span
              className={styles.itemBadge}
              style={{
                backgroundColor: product.tags[0].color,
                color: readableTextColor(product.tags[0].color),
              }}
            >
              {product.tags[0].name}
            </span>
          ) : null}
          <h2 className={styles.itemTitle}>{product.name}</h2>
          <p className={styles.itemMeta}>{product.headline || product.category}</p>
          <p className={styles.itemUnitPrice}>{t("unitPrice", { price: formattedUnitPrice })}</p>
        </div>

        <div className={styles.itemActions}>
          <CheckoutCartItemControls product={product} quantity={quantity} />
        </div>
      </div>

      <strong className={styles.itemPrice}>{formattedLineTotal}</strong>
    </article>
  );
}
