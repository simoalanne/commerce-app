"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";

import styles from "./Carousel.module.css";

type CarouselProps<TItem> = {
  items: TItem[];
  getItemKey: (item: TItem, index: number) => string | number;
  renderItem: (item: TItem, index: number) => ReactNode;
  centerItemsWhenStatic?: boolean;
};

export default function Carousel<TItem>({
  items,
  getItemKey,
  renderItem,
  centerItemsWhenStatic = false,
}: CarouselProps<TItem>) {
  const t = useTranslations("carousel");
  const listRef = useRef<HTMLUListElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = listRef.current;
    let isMounted = true;

    if (!element) {
      return;
    }

    const update = () => {
      if (!isMounted) {
        return;
      }

      const { scrollLeft, scrollWidth, clientWidth } = element;
      const maxScrollLeft = scrollWidth - clientWidth;

      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < maxScrollLeft - 5);
      setIsOverflowing(scrollWidth > clientWidth + 5);
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      isMounted = false;
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  const scrollByAmount = (amount: number) => {
    const element = listRef.current;
    if (!element) {
      return;
    }

    element.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handlePrevious = () => {
    const element = listRef.current;
    if (!element) {
      return;
    }

    const amount = Math.min(element.clientWidth * 0.8, element.scrollLeft);
    scrollByAmount(-amount);
  };

  const handleNext = () => {
    const element = listRef.current;
    if (!element) {
      return;
    }

    const maxRight = element.scrollWidth - element.clientWidth - element.scrollLeft;
    const amount = Math.min(element.clientWidth * 0.8, maxRight);
    scrollByAmount(amount);
  };

  return (
    <div className={styles.root}>
      <ul
        ref={listRef}
        className={`${styles.track} ${
          centerItemsWhenStatic && !isOverflowing ? styles.trackCentered : ""
        }`}
      >
        {items.map((item, index) => (
          <li key={getItemKey(item, index)} className={styles.item}>
            {renderItem(item, index)}
          </li>
        ))}
      </ul>

      {canScrollLeft ? (
        <div className={`${styles.scrollIndicator} ${styles.leftIndicator}`}>
          <button
            type="button"
            onClick={handlePrevious}
            aria-label={t("previous")}
            className={styles.indicatorButton}
          >
            <ChevronLeft size={22} />
          </button>
        </div>
      ) : null}

      {canScrollRight ? (
        <div className={`${styles.scrollIndicator} ${styles.rightIndicator}`}>
          <button
            type="button"
            onClick={handleNext}
            aria-label={t("next")}
            className={styles.indicatorButton}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
