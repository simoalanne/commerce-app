"use client";
import Image from "next/image";
import { useRef } from "react";

import { Link } from "@/i18n/navigation";
import type { ProductSummary } from "@/types/api";

import styles from "./ToggledViewProductsList.module.css";

type ProductCardVariant = "detailed" | "minimal";

interface ProductProps {
  products: ProductSummary[];
  cardVariant?: ProductCardVariant;
  headingLevel?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div";
}

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
export default function ToggledViewProductsList({
  products,
  cardVariant = "detailed",
  headingLevel = "h3",
}: ProductProps) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const HeadingTag = headingLevel;

  return (
    <div>
      <ul ref={listRef} className={styles.list}>
        {products.map((p) => {
          return (
            <li key={p.id} className={styles.listItem}>
              <article
                className={joinClassNames(
                  styles.card,
                  cardVariant === "detailed" ? styles.cardDetailed : styles.cardMinimal,
                )}
              >
                <Link href={`/products/${p.slug}`} className={styles.cardLink}>
                  {p.imageUrl && (
                    <div className={styles.imageWrapper}>
                      <Image
                        src={p.imageUrl}
                        alt={p.name}
                        fill
                        sizes="(max-width: 480px) 50vw, (max-width: 768px) 25vw, 130px"
                        className={styles.productImage}
                      />
                    </div>
                  )}

                  <div className={styles.productCardInfobox}>
                    <HeadingTag className={styles.productName}>{p.name}</HeadingTag>
                  </div>
                </Link>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
