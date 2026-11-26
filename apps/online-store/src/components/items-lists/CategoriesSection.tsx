"use client";

import { slugify } from "@acme/shared";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import Carousel from "@/components/carousel/Carousel";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/types/api";

import styles from "./CategoriesSection.module.css";

type ListLayout = "grid" | "carousel";

type CategoriesSectionProps = {
  title: string;
  linkHref: string;
  linkLabel: string;
  linkIcon?: ReactNode;
  categories: Category[];
  layout?: ListLayout;
};

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function CategoriesSection({
  title,
  linkHref,
  linkLabel,
  linkIcon,
  categories,
  layout = "grid",
}: CategoriesSectionProps) {
  const renderCategoryCard = (category: Category) => {
    const params = new URLSearchParams({ category: slugify(category.name) });
    const href = `/products?${params.toString()}`;

    return (
      <Link href={href} className={styles.card} prefetch={false}>
        <div className={styles.imgWrapper}>
          {category.imageUrl ? (
            <Image
              src={category.imageUrl}
              alt={category.name}
              fill
              className={styles.categoryImage}
              sizes="(max-width: 768px) 200px, 240px"
            />
          ) : (
            <div className={styles.categoryImageFallback} />
          )}
        </div>
        <div className={styles.cardContent}>
          <span className={styles.categoryName}>{category.name}</span>
          <ChevronRight size={18} className={styles.arrowIcon} />
        </div>
      </Link>
    );
  };

  if (layout === "carousel") {
    return (
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <h2>{title}</h2>
          <Link href={linkHref} className={styles.seeDirectory}>
            {linkLabel} {linkIcon}
          </Link>
        </div>
        <Carousel
          items={categories}
          getItemKey={(c) => c.id}
          renderItem={(c) => <div className={styles.carouselItem}>{renderCategoryCard(c)}</div>}
        />
      </section>
    );
  }

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <Link href={linkHref} className={styles.seeDirectory}>
          {linkLabel} {linkIcon}
        </Link>
      </div>
      <ul className={joinClassNames(styles.list, styles.gridLayout)}>
        {categories.map((c) => (
          <li key={c.id} className={styles.gridItem}>
            {renderCategoryCard(c)}
          </li>
        ))}
      </ul>
    </section>
  );
}
