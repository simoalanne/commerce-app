import type { ProductSearchDocumentData } from "#src/db/json.ts";

import postgresSearchProvider from "./postgresSearch.provider.ts";

export type SearchResultProduct = ProductSearchDocumentData["product"];

export type SearchResultVendor = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
};

export type SearchResultCategory = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
};

export type SearchResult = {
  total: number;
  results: {
    products: SearchResultProduct[];
    vendors: SearchResultVendor[];
    categories: SearchResultCategory[];
  };
};

export type SearchInput = {
  q: string;
  locale: string;
  limit?: number;
  offset?: number;
};

export type InitialSearchDataInput = {
  locale: string;
  limit?: number;
};

export type SearchIndexInvalidationInput = {
  productIds: number[];
};

export interface SearchProvider {
  search(input: SearchInput): Promise<SearchResult>;

  getInitialData(input: InitialSearchDataInput): Promise<SearchResult>;

  invalidateIndex(input: SearchIndexInvalidationInput): Promise<void>;
}

export const searchProvider: SearchProvider = postgresSearchProvider;
