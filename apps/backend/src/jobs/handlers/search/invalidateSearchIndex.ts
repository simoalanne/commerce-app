import {
  type SearchIndexInvalidationInput,
  searchProvider,
} from "#src/integrations/search/search.provider.ts";

export async function invalidateSearchIndex({ productIds }: SearchIndexInvalidationInput) {
  await searchProvider.invalidateIndex({ productIds });
}
