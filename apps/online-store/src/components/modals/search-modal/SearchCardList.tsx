import { useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { formatCents } from "@/utils/formatPrice";

import styles from "./SearchModalProductsList.module.css";

type BaseSearchCardItem = {
  id: number;
  name: string;
  imageUrl: string | null;
  href: string;
};

export type SearchCardItem =
  | (BaseSearchCardItem & {
      type: "product";
      priceCents: number;
      outOfStock: boolean;
    })
  | (BaseSearchCardItem & {
      type: "generic";
    });

interface SearchCardListProps {
  items: SearchCardItem[];
  onClose?: () => void;
}

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function SearchCard({ item, onClose }: { item: SearchCardItem; onClose?: () => void }) {
  const t = useTranslations("productListing");

  return (
    <article className={styles.card}>
      <Link
        prefetch={false}
        href={item.href}
        className={styles.cardLink}
        onClick={() => onClose?.()}
      >
        <div className={styles.imgWrapper}>
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 768px) 50vw, 200px"
              className={styles.productImage}
            />
          ) : (
            <div className={styles.imagePlaceholder} />
          )}
          {item.type === "product" && item.outOfStock && (
            <p className={styles.outOfStock}>{t("product.outOfStock")}</p>
          )}
        </div>

        <div className={styles.productCardInfobox}>
          <h3 className={styles.productName}>{item.name}</h3>
          {item.type === "product" && (
            <div className={styles.productMetaRow}>
              <div className={styles.priceBlock}>
                <p className={styles.price}>{formatCents(item.priceCents)}</p>
              </div>
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}

export default function SearchCardList({ items, onClose }: SearchCardListProps) {
  return (
    <ul className={joinClassNames(styles.list, styles.gridLayout)}>
      {items.map((item) => {
        return (
          <li key={item.id} className={joinClassNames(styles.listItem, styles.gridItem)}>
            <SearchCard item={item} onClose={onClose} />
          </li>
        );
      })}
    </ul>
  );
}
