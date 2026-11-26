/**
 * DestructuredRouteParams is the type that matches the shape of the params received by page.tsx, layout.tsx and generateMetadata() functions in the app directory
 * but with the params object already destructured. This should be used by all the regular server helper functions that need access to the route params.
 * @example
 * // in a server helper function that needs access to route params
 * export async function serverHelperFunction(params: DestructuredRouteParams) {
 *   const { locale } = await params;
 *   return await getTranslations({ locale });
 * }
 *
 */
export type DestructuredRouteParams = Promise<{
  locale: string;
  category?: string;
  vendor?: string;
  product?: string;
}>;

/**
 * RouteParams is the type that matches the shape of the props received by page.tsx, layout.tsx and generateMetadata() functions in the app directory.
 * Use this type or an extended version of it for all server components so that components can easily prop drill the params down without each component
 * deciding it's own shape for the params or only accepting for example only locale forcing caller to do more work.
 * @example
 * // in page.tsx or layout.tsx or generateMetadata() function
 * export default async function Page({ params }: RouteParams) {
 *   // server helper should accept destructured params so it can be called directly.
 *   const translations = await getServerTranslations(params);
 *
 *   // ServerHelperComponent here should accept the same RouteParams type so that it can be called directly without needing to destructure or reshape the params.
 *   // It doesn't matter if ServerHelperComponent needs all the params or not but this allows least ceremony when it comes to passing params through multiple layers of components
 *   // and keeps the components as self contained as possible.
 *   return (
 *     <div>
 *      <h1>{translations.title}</h1>
 *      <ServerHelperComponent params={params} />
 *     </div>
 *   );
 * }
 */
export type RouteParams = { params: DestructuredRouteParams };
