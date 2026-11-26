import type { ObjectStorageProvider } from "#src/integrations/object-storage/objectStorage.provider.ts";

// For `with: { images: ... }` on products and vendors, whose image links
// carry the image.
export const ALL_LINKED_IMAGES_SELECT = {
  columns: {},
  with: { image: { columns: { storageKey: true } } },
} as const;

export const FIRST_LINKED_IMAGE_SELECT = { ...ALL_LINKED_IMAGES_SELECT, limit: 1 } as const;

export type ImageLinkWithUrl = {
  image: {
    storageKey: string;
  };
};

type PublicUrlStorage = Pick<ObjectStorageProvider, "getPublicUrl">;

export const getFirstLinkedImageUrl = (
  storage: PublicUrlStorage,
  links: ImageLinkWithUrl[] | null | undefined,
) => (links?.[0]?.image.storageKey ? storage.getPublicUrl(links[0].image.storageKey) : null);

export const getLinkedImageUrls = (
  storage: PublicUrlStorage,
  links: ImageLinkWithUrl[] | null | undefined,
) => (links ?? []).map((link) => storage.getPublicUrl(link.image.storageKey));
