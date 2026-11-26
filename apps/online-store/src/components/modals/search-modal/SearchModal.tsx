"use client";

import { type InferClientResponse, safe } from "@rest-rpc/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { Api } from "@/api/client";
import { Modal } from "@/components/Modal";
import { useApiClient } from "@/providers/ApiClientProvider";

import SearchCardList, { type SearchCardItem } from "./SearchCardList";
import SearchModalInput from "./SearchModalInput";

import styles from "./SearchModalProductsList.module.css";

type SearchResponse = InferClientResponse<Api["search"]["query"]>["body"];
type SearchState = "initialData" | "noResults" | "results";
type SearchSection = {
  title: string;
  items: SearchCardItem[];
};

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SearchSections({ sections, onClose }: { sections: SearchSection[]; onClose: () => void }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.title}>
          <p className={styles.modalSubTitle}>{section.title}</p>
          <SearchCardList items={section.items} onClose={onClose} />
        </section>
      ))}
    </>
  );
}

function SearchContent({
  state,
  initialItems,
  sections,
  noResultsLabel,
  onClose,
}: {
  state: SearchState;
  initialItems: SearchCardItem[];
  sections: SearchSection[];
  noResultsLabel: string;
  onClose: () => void;
}) {
  if (state === "initialData") {
    return <SearchCardList items={initialItems} onClose={onClose} />;
  }

  if (state === "noResults") {
    return <p className={styles.paragraph}>{noResultsLabel}</p>;
  }

  return <SearchSections sections={sections} onClose={onClose} />;
}

/**
 * SearchModal
 * - client-side component that shows a search input
 * - uses a debounced query to avoid excessive requests
 * - queries server for search results once the query is long enough
 */
export default function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const { queryUtils } = useApiClient();
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setSearchResults(null);
      setHasSearched(false);
    }
  }, [open]);

  // Debounce search input so we do not query on every keystroke.
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  const cleaned = debouncedQuery;
  const { data: initialData } = useQuery(
    queryUtils.search.getInitialData.queryOptions({
      enabled: open,
      select: (response) => response.body,
    }),
  );

  useEffect(() => {
    if (!open || cleaned.length < 2) {
      setSearchResults(null);
      setHasSearched(false);
      return;
    }

    let cancelled = false;

    safe(queryUtils.search.query.fetch({ query: { q: cleaned } })).then(({ error, data }) => {
      if (cancelled) return;

      if (!error) {
        setSearchResults(data.body);
        setHasSearched(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [queryUtils, cleaned, open]);

  const foundProducts = searchResults?.results.products ?? [];
  const foundVendors = searchResults?.results.vendors ?? [];
  const foundCategories = searchResults?.results.categories ?? [];
  const showDefaultProducts = debouncedQuery.length < 2;

  const initialItems = (initialData?.results.products ?? []).map((product) => ({
    ...product,
    type: "product" as const,
    href: `/products/${product.slug}`,
  }));
  const sections: SearchSection[] = [
    {
      title: t("header.vendors"),
      items: foundVendors.map<SearchCardItem>((vendor) => ({
        ...vendor,
        type: "generic" as const,
        href: `/vendors/${vendor.slug}`,
      })),
    },
    {
      title: t("header.categories"),
      items: foundCategories.map<SearchCardItem>((category) => ({
        ...category,
        type: "generic" as const,
        href: `/products?category=${category.slug}`,
      })),
    },
    {
      title: t("header.products"),
      items: foundProducts.map<SearchCardItem>((product) => ({
        ...product,
        type: "product" as const,
        href: `/products/${product.slug}`,
      })),
    },
  ].filter((section) => section.items.length > 0);

  const searchState = showDefaultProducts
    ? "initialData"
    : sections.length > 0
      ? "results"
      : hasSearched
        ? "noResults"
        : "initialData";

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("header.searchModal.title")}>
      <div>
        <SearchModalInput
          value={query}
          onChange={setQuery}
          placeholder={t("header.searchModal.title")}
          ref={inputRef}
        />
        <div className={styles.divider}></div>

        <div className={styles.SearchResultsContainer}>
          <SearchContent
            state={searchState}
            initialItems={initialItems}
            sections={sections}
            noResultsLabel={t("header.searchModal.noResults")}
            onClose={handleClose}
          />
        </div>
      </div>
    </Modal>
  );
}
