import type { ReactNode } from "react";

import ListOfProducts from "@/components/homePage.tsx/ListOfProducts";
import { Link } from "@/i18n/navigation";
import type { ProductSummary } from "@/types/api";

import styles from "./ProductsSection.module.css";

type ProductListLayout = "grid" | "carousel";
type ProductCardVariant = "detailed" | "minimal";

type ProductsSectionProps = {
  title: string;
  linkHref: string;
  linkLabel: string;
  linkIcon?: ReactNode;
  products: ProductSummary[];
  layout?: ProductListLayout;
  cardVariant?: ProductCardVariant;
};

export default function ProductsSection({
  title,
  linkHref,
  linkLabel,
  linkIcon,
  products,
  layout = "grid",
  cardVariant = "detailed",
}: ProductsSectionProps) {
  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <Link href={linkHref} className={styles.seeDirectory}>
          {linkLabel} {linkIcon}
        </Link>
      </div>
      <ListOfProducts products={products} layout={layout} cardVariant={cardVariant} />
    </section>
  );
}
