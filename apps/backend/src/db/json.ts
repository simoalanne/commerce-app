// Shapes of the JSON columns, attached to them with .$type<T>() in schema.ts.
import type { SupportedLocale } from "#src/locales.ts";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

// Keys are exactly SupportedLocale so resolveLocalizedFields() can tell localized values
// from other records, such as Record<string, string> fields.
type LocalizedValueLike<TValue> = Partial<Record<SupportedLocale, TValue>>;

export type LocalizedString = LocalizedValueLike<string>;
export type LocalizedStringArray = LocalizedValueLike<string[]>;

export type DeliveryInstructions = {
  freeForm?: string;
  apartmentEntrance?: "buzzer" | "code" | "openDoor" | "other";
  doorCode?: string;
};

export type CustomerAddressDeliveryDetails = {
  addressType?: "HOUSE" | "APARTMENT" | null;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  deliveryInstructions?: DeliveryInstructions;
};

export type OrderDetails = {
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  delivery: {
    addressLabel: string;
    city: string;
    instructions: DeliveryInstructions | null;
  };
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
    imageUrl: string;
    priceCents: number;
    outOfStock: boolean;
  };
  vendor: {
    id: number;
    name: string;
    slug: string;
    imageUrl: string;
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
