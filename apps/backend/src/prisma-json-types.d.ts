import type { SupportedLocale } from "./locales.ts";

// Keys are exactly SupportedLocale so toResponse() can tell localized values
// from other records, such as Record<string, string> fields.
type LocalizedValueLike<TValue> = Partial<Record<SupportedLocale, TValue>>;

declare global {
  namespace PrismaJson {
    type LocalizedString = LocalizedValueLike<string>;
    type LocalizedStringArray = LocalizedValueLike<string[]>;
    type LocalizedStringOptional = LocalizedValueLike<string>;
    type DeliveryInstructions = {
      freeForm?: string;
      apartmentEntrance?: "buzzer" | "code" | "openDoor" | "other";
      doorCode?: string;
    };
    type FavoriteProducts = {
      items: Record<
        string,
        {
          addedAt: string;
        }
      >;
    };
    type FavoriteVendors = {
      items: Record<
        string,
        {
          addedAt: string;
        }
      >;
    };
    type CustomerAddressDeliveryDetails = {
      addressType?: "HOUSE" | "APARTMENT" | null;
      entrance?: string | null;
      floor?: string | null;
      apartment?: string | null;
      deliveryInstructions?: DeliveryInstructions;
    };
    type OrderDetails = {
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
    type OrderInvoiceDetails = {
      seller: {
        name: string;
        businessId: string;
        address: string;
      };
    };

    type ProductSearchDocumentData = {
      product: {
        id: number;
        name: string;
        slug: string;
        imageUrl: string;
        price: number;
        pricePerKg: number | null;
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
  }
}
