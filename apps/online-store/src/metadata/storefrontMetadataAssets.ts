const rawAssetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL?.trim();

const assetsBaseUrl = rawAssetsUrl ? rawAssetsUrl.replace(/\/+$/, "") : undefined;

function buildStorefrontImageUrl(imageKey: string): string | undefined {
  return assetsBaseUrl ? `${assetsBaseUrl}/images/${imageKey}` : undefined;
}

export const storefrontMetadataAssets = {
  contactHeroImageUrl: buildStorefrontImageUrl("contact-us-hero-img"),
  defaultSocialShareImageUrl: buildStorefrontImageUrl("default-social-share"),
};
