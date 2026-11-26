// Shapes of the JSON columns, attached to them with .$type<T>() in schema.ts.
import type { ShippingAddress } from "@acme/shared/schemas/shippingAddress";

import type { SupportedLocale } from "#src/locales.ts";

// Keys are exactly SupportedLocale so resolveLocalizedFields() can tell localized values
// from other records, such as Record<string, string> fields.
type LocalizedValueLike<TValue> = Partial<Record<SupportedLocale, TValue>>;

export type LocalizedString = LocalizedValueLike<string>;
export type LocalizedStringArray = LocalizedValueLike<string[]>;

export type OrderDetails = {
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: ShippingAddress;
};

export type OrderInvoiceDetails = {
  seller: {
    name: string;
    businessId: string;
    address: string;
  };
};

export type ProductSearchDocumentData = {
  product: {
    id: number;
    name: string;
    slug: string;
    imageUrl: string | null;
    priceCents: number;
    outOfStock: boolean;
  };
  vendor: {
    id: number;
    name: string;
    slug: string;
    imageUrl: string | null;
  };
  category: {
    id: number;
    name: string;
    slug: string;
    imageUrl: string;
  } | null;
  ranking: {
    isFeatured: boolean;
    createdAt: string;
  };
};
