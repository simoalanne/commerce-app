"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

import styles from "./ProductDescription.module.css";

type ProductDescriptionProps = {
  fullDescription: string;
};

export default function ProductDescription({ fullDescription }: ProductDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsible, setIsCollapsible] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const tProductPage = useTranslations("productPage");

  useEffect(() => {
    if (contentRef.current) {
      // If the content is taller than our CSS max-height, we need a toggle.
      setIsCollapsible(contentRef.current.scrollHeight > contentRef.current.clientHeight);
    }
  }, []);

  const cleanedDescription = fullDescription
    .replace(/data-path-to-node="[^"]*"/g, "")
    .replace(/data-index-in-node="[^"]*"/g, "")
    .replace(/^[ \t]+(<)/gm, "$1")
    .replace(/\\=/g, "=");

  return (
    <div className={`${styles.descriptionWrapper} quotes`}>
      <div
        ref={contentRef}
        className={`${styles.productDescription} ${
          isExpanded ? styles.expanded : ""
        } ${isCollapsible && !isExpanded ? styles.hasGradient : ""}`}
      >
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{cleanedDescription}</ReactMarkdown>
      </div>
      {isCollapsible && (
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? tProductPage("readLess") : tProductPage("readMore")}
        </button>
      )}
    </div>
  );
}
