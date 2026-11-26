import type { ObjectStorageProvider } from "#src/integrations/object-storage/objectStorage.provider.ts";

export const IMAGE_PLACEHOLDER_URL = "https://placehold.co";

export const IMAGE_LINK_WITH_STORAGE_KEY_SELECT = {
  image: {
    select: {
      storage_key: true,
    },
  },
} as const;

export const FIRST_LINKED_IMAGE_SELECT = {
  take: 1,
  select: IMAGE_LINK_WITH_STORAGE_KEY_SELECT,
} as const;

export const ALL_LINKED_IMAGES_SELECT = {
  select: IMAGE_LINK_WITH_STORAGE_KEY_SELECT,
} as const;

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
