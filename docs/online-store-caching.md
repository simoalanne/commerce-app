# Online Store Caching

How the online store caches customer API reads and how the backend invalidates them.

## Model

- Public storefront reads are cached by default, each with Next.js cache tags.
- Backend mutations invalidate the tags for the data they changed.
- User-specific state and submit-time behavior stay dynamic.
- Checkout submit is the final authority on stock, pricing and order validity. Cached data is the best current view, never the truth.
- Reads also have a time-based TTL (900s by default). It is only a safety net for a missed invalidation; raise or remove it once tag invalidation is trusted.

A page can render dynamically (for example, checkout reads the cart cookie) and still use cached reads for public data such as product details. Dynamic rendering doesn't mean uncached backend reads.

## How It Works

- The store's server-side API client tags reads automatically from the route path and its path parameters. The backend builds the same tags with `buildTag` when it changes the underlying data.
- The store exposes an internal route, `/api/internal/cache/invalidate`, protected by a shared secret.
- Backend handlers never call that route directly. They enqueue an `invalidateStorefrontCache` job, in the same transaction as the change, so the invalidation HTTP call runs only after the mutation commits.
- Invalidation is asynchronous, so a job can fail or exhaust its retries. The TTL covers that case.

Configuration: the backend and the store need the same `INTERNAL_API_KEY` (a random string of at least 32 characters). The backend also needs `ONLINE_STORE_URL` to reach the store.

## Stock

Stock is the hard case because it changes outside normal product edits. Every path that changes stock invalidates the product's tags:

- checkout payment creation reserves stock
- payment reconciliation cancels, recovers or finalizes an order
- pending-order expiry releases reserved stock
- dashboard stock edits

So product cards, product pages and checkout server state use normal cached product reads, with no separate availability endpoint and no waiting for a payment callback before rendering. If stock is gone when the customer submits, checkout returns the normal checkout error.
