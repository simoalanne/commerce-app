import { CheckoutPage } from "@/features/checkout/CheckoutPage";

export { generateCartMetadata as generateMetadata } from "@/metadata/noIndexMetadata";

import type { RouteParams } from "@/types";

// TODO: this does not need to be dynamic if backend tells nextjs when product availability changes.
// This is a tradeoff between complexity and performance.
export const dynamic = "force-dynamic";

export default function CartPage({ params }: RouteParams) {
  return <CheckoutPage params={params} />;
}
