import "server-only";
import type { Metadata } from "next";

import { getServerTranslations } from "@/i18n/serverTranslations";
import createServerSideApiClient from "@/server/serverApiClient";
import {
  getCurrentVendor,
  getCurrentProduct,
  getCurrentProductSummary,
} from "@/server/storefrontContext";
import type { RouteParams } from "@/types";

import { buildPageMetadata } from "./buildPageMetadata";
import { storefrontMetadataAssets } from "./storefrontMetadataAssets";

export async function generateLandingPageMetadata({ params }: RouteParams): Promise<Metadata> {
  const { locale } = await params;
  const tLanding = await getServerTranslations(params, "metadata.landingPage");

  return await buildPageMetadata({
    locale,
    title: tLanding("openGraph.openGraphTitle"),
    description: tLanding("openGraph.openGraphDesc"),
    pathname: "/",
  });
}

export async function generateProductListingMetadata({ params }: RouteParams): Promise<Metadata> {
  const { locale } = await params;
  const tProduct = await getServerTranslations(params, "metadata.productListing");
  const api = await createServerSideApiClient(params);
  const { body: products } = await api.products.getAll();

  return await buildPageMetadata({
    locale,
    title: tProduct("openGraph.openGraphTitle"),
    description: tProduct("openGraph.openGraphDesc"),
    pathname: "/products",
    imageUrl: products[0]?.imageUrl,
  });
}

export async function generateProductDetailsMetadata({ params }: RouteParams): Promise<Metadata> {
  const { locale } = await params;
  const productSummary = await getCurrentProductSummary(params);
  const product = await getCurrentProduct(params);
  const tProduct = await getServerTranslations(params, "metadata.productPage");
  const api = await createServerSideApiClient(params);
  const { body: vendor } = await api.vendors.getById({
    params: { id: productSummary.vendorId },
  });

  return await buildPageMetadata({
    locale,
    title: `${product.name} | ${vendor.name}`,
    description: product.headline || tProduct("openGraph.openGraphDesc"),
    pathname: `/products/${product.slug}`,
    imageUrl: product.imageUrl,
  });
}

export async function generateVendorListingMetadata({ params }: RouteParams): Promise<Metadata> {
  const { locale } = await params;
  const tVendor = await getServerTranslations(params, "metadata.vendorListing");
  const api = await createServerSideApiClient(params);
  const { body: vendors } = await api.vendors.getAll();

  return await buildPageMetadata({
    locale,
    title: tVendor("openGraph.openGraphTitle"),
    description: tVendor("openGraph.openGraphDesc"),
    pathname: "/vendors",
    imageUrl: vendors[0]?.imageUrl,
  });
}

export async function generateVendorDetailsMetadata({ params }: RouteParams): Promise<Metadata> {
  const { locale } = await params;
  const vendor = await getCurrentVendor(params);
  const tVendor = await getServerTranslations(params, "metadata.vendorPage");

  return await buildPageMetadata({
    locale,
    title: tVendor("openGraph.openGraphTitle", { vendor: vendor.name }),
    description: tVendor("openGraph.openGraphDesc", { vendor: vendor.name }),
    pathname: `/vendors/${vendor.slug}`,
    imageUrl: vendor.imageUrl ?? undefined,
  });
}

export async function generateContactPageMetadata({ params }: RouteParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getServerTranslations(params, "metadata.contactUsPage");

  return await buildPageMetadata({
    locale,
    title: t("openGraphTitle"),
    description: t("openGraphDesc"),
    pathname: "/contact",
    imageUrl: storefrontMetadataAssets.contactHeroImageUrl,
  });
}
