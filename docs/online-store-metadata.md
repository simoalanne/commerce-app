# Online Store Metadata

Last updated: 2026-07-29

This document explains how metadata is currently handled in `apps/online-store`.

The goal is to keep metadata generation explicit, centralized, and easy to audit.

## Intent

The rules:

- keep `app/**` route files thin
- keep metadata rules in `apps/online-store/src/metadata/**`
- make page metadata explicit instead of relying on accidental fallbacks
- keep translation strings for metadata grouped under `metadata.*` in locale JSON files
- separate public SEO metadata from private or transactional `noindex` metadata

Metadata is treated as route policy, not feature implementation.

## Ownership

The current ownership split is:

- `src/app/**`: re-export or lightly wire `generateMetadata`
- `src/metadata/siteMetadata.ts`: truly global metadata only
- `src/metadata/localeLayoutMetadata.ts`: locale-aware default metadata for `[locale]`
- `src/metadata/buildPageMetadata.ts`: shared builder for public localized pages
- `src/metadata/storefrontMetadata.ts`: public storefront route metadata
- `src/metadata/noIndexMetadata.ts`: reusable metadata for private and transactional pages

The important rule is that route files should not become the main place where metadata policy is written.

## Global Metadata

Global metadata lives in `src/metadata/siteMetadata.ts`.

It should only contain metadata that is genuinely global, for example:

- `metadataBase`
- `applicationName`
- `referrer`
- `formatDetection`
- global `robots` default
- global `openGraph` structure
- global `twitter` structure

It should not be used as a bucket for generic fallback page copy.

## Locale Defaults

Locale-aware default page metadata lives in `src/metadata/localeLayoutMetadata.ts` and is re-exported from `[locale]/layout.tsx`.

This provides the localized baseline for:

- `title`
- `description`
- `openGraph.title`
- `openGraph.description`
- `twitter.title`
- `twitter.description`

This is the default layer for public localized pages. It is not meant to hide missing route metadata forever, but it prevents the app from falling back to unrelated generic root metadata.

## Public Page Metadata

Public indexable pages use `buildPageMetadata()`.

Current builder rules:

- `title` is required
- `description` is required
- `pathname` is required
- `pathname` must already be explicitly correct
- locale is resolved inside the builder
- the builder returns relative canonical and Open Graph URLs
- `metadataBase` from `siteMetadata` resolves those relative URLs to absolute ones

The builder does not:

- normalize pathnames
- trim segments
- repair missing slashes
- guess route structure
- parse the public site URL on its own

That keeps the contract stricter and avoids silent corrections.

## Noindex Pages

Private, transactional, or otherwise non-indexable pages use `src/metadata/noIndexMetadata.ts`.

These pages still need intentional metadata, but they usually do not need the same SEO treatment as public pages.

Current rules for `noindex` pages:

- `robots.index = false`
- `robots.follow = false`
- explicit page `title` is still required
- `description` is optional

The reusable entry point is `generateNoIndexMetadata(titleKey)`, with named exports for specific routes such as payment, cart, favorites, account pages, and confirmation pages.

This avoids repeating `robots` policy while still keeping titles explicit.

## Translation Structure

Metadata translations live under the top-level `metadata` key in locale JSON files.

Examples:

- `metadata.defaults`
- `metadata.landingPage`
- `metadata.marketplacePage`
- `metadata.productListing`
- `metadata.productPage`
- `metadata.vendorListing`
- `metadata.vendorPage`
- `metadata.contactUsPage`
- `metadata.joinAsVendorPage`
- `metadata.noIndex`

Metadata code should read from metadata keys, not from unrelated UI copy that happens to look similar.

## Layouts vs Pages

Metadata in Next App Router is hierarchical.

That means:

- top-level layouts are a good place for real shared defaults
- nested layouts should only provide metadata when the whole subtree genuinely shares that policy
- pages should usually own their own specific titles and descriptions

In this storefront, the preferred pattern is:

- use `[locale]/layout.tsx` for locale-wide defaults
- keep nested layout metadata minimal or avoid it when it only duplicates page metadata
- let individual pages explicitly export their own metadata generators

## Adding New Metadata

When adding a new public page:

1. Add metadata strings under `metadata.*` in locale JSON files.
2. Add or reuse a generator in `src/metadata/**`.
3. Re-export that generator from the route file.

When adding a new private or transactional page:

1. Add a title key under `metadata.noIndex`.
2. Add or reuse a helper in `src/metadata/noIndexMetadata.ts`.
3. Re-export it from the route file.
