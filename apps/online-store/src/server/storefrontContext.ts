import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";

import createServerSideApiClient from "@/server/serverApiClient";
import type { DestructuredRouteParams } from "@/types";

export const getStorefrontContext = cache(async (params: DestructuredRouteParams) => {
  const apiClient = await createServerSideApiClient(params);
  return (await apiClient.storefront.getContext()).body;
});

const findOrThrow = <T extends { slug: string }>(items: T[], slug?: string): T => {
  const match = items.find((item) => item.slug === slug);
  if (!match) {
    notFound();
  }
  return match;
};

export const getCurrentProductSummary = async (params: DestructuredRouteParams) => {
  const ctx = await getStorefrontContext(params);
  const slug = await params.then((p) => p.product);
  return findOrThrow(ctx.products, slug);
};

const getCurrentVendorSummary = async (params: DestructuredRouteParams) => {
  const ctx = await getStorefrontContext(params);
  const slug = await params.then((p) => p.vendor);
  return findOrThrow(ctx.vendors, slug);
};

const getCurrentCategorySummary = async (params: DestructuredRouteParams) => {
  const ctx = await getStorefrontContext(params);
  const slug = await params.then((p) => p.category);
  return findOrThrow(ctx.categories, slug);
};

export const getCurrentProduct = async (params: DestructuredRouteParams) => {
  const match = await getCurrentProductSummary(params);
  const apiClient = await createServerSideApiClient(params);
  return (await apiClient.products.getById({ params: { id: match.id } })).body;
};

export const getCurrentVendor = async (params: DestructuredRouteParams) => {
  const match = await getCurrentVendorSummary(params);
  const apiClient = await createServerSideApiClient(params);
  return (await apiClient.vendors.getById({ params: { id: match.id } })).body;
};

export const getCurrentCategory = async (params: DestructuredRouteParams) => {
  const match = await getCurrentCategorySummary(params);
  const apiClient = await createServerSideApiClient(params);
  const { body: allCategories } = await apiClient.categories.getAll();
  return findOrThrow(allCategories, match.slug);
};
