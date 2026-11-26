import type { ObjectStorageProvider } from "#src/integrations/object-storage/objectStorage.provider.ts";

export const IMAGE_PLACEHOLDER_URL = "https://placehold.co";

// For `with: { images: ... }` on products and vendors, whose image links
// carry the image.
export const ALL_LINKED_IMAGES_SELECT = {
  columns: {},
  with: { image: { columns: { storage_key: true } } },
} as const;

export const FIRST_LINKED_IMAGE_SELECT = { ...ALL_LINKED_IMAGES_SELECT, limit: 1 } as const;

export type ImageLinkWithUrl = {
  image: {
    storage_key: string;
  };
};

type PublicUrlStorage = Pick<ObjectStorageProvider, "getPublicUrl">;

export const getFirstLinkedImageUrl = (
  storage: PublicUrlStorage,
  links: ImageLinkWithUrl[] | null | undefined,
) =>
  links?.[0]?.image.storage_key
    ? storage.getPublicUrl(links[0].image.storage_key)
    : IMAGE_PLACEHOLDER_URL;

export const getLinkedImageUrls = (
  storage: PublicUrlStorage,
  links: ImageLinkWithUrl[] | null | undefined,
) => (links ?? []).map((link) => storage.getPublicUrl(link.image.storage_key));
