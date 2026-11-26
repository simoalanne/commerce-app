# Storefront Visibility

Last updated: 2026-11-22

This document explains how customer-facing visibility is intended to work for storefront entities.

The main idea is simple:

Dashboard users should be able to decide whether an entity is visible on the customer storefront, and customer APIs should consistently hide inactive storefront data.

## Data Model

Storefront-visible entities use:

```prisma
storefront_visibility StorefrontVisibility @default(ACTIVE)
is_featured           Boolean             @default(false)
```

`StorefrontVisibility` has two values:

- `ACTIVE`
- `INACTIVE`

`storefront_visibility` controls whether the entity is customer-visible.

`is_featured` is separate because featuring is a display/ranking concern, not a visibility concern. An inactive entity should not be returned to customers just because it is featured.

## Entities

The storefront visibility model currently applies to:

- `Product`
- `Vendor`

## Customer API Rules

Customer APIs should only return active storefront data.

The effective rules are:

- Vendors require an active vendor.
- Products require an active product and active vendor.

Parent visibility matters because child entities should not be customer-visible through an inactive parent.

For example, an active product under an inactive vendor should not appear on the storefront.

## Search Index

Search uses denormalized `ProductSearchDocument` rows.

Vendor and category search results are not independent index rows. They are derived from matching product search documents:

- product results come from indexed product data
- vendor cards come from product documents' embedded vendor data
- category cards come from product documents' embedded category data

This means product and vendor visibility affect whether product search documents are valid.

When a product becomes inactive, its product search documents should be removed through search invalidation.

When a vendor becomes inactive, affected product search documents should be removed through search invalidation, because those documents embed vendor data and can produce vendor search cards.

So the search rules are:

- Product inactive: invalidate affected product search documents.
- Vendor inactive: invalidate affected vendor product search documents.

## Dashboard

Dashboard forms should expose storefront visibility and featured state together for supported entities.

The fields are conceptually shared:

- storefront visibility decides customer visibility
- featured decides display priority or highlighting

Dashboard API responses should include both values so forms and tables can show the current storefront state consistently.
