# Safe Token Handling

Last updated: 2026-07-15

This document describes how customer-facing token links should be handled.

The core rule is:

Long-lived or durable tokens should not become normal API credentials.

Client JavaScript should only ever see short-lived tokens, and only if the flow requires it.

## Token Classes

There are two valid classes of tokens, out of which **JWT** should be the preferred option:

### JWTs

Use signed JWTs with a sensible expiry for tokens that are short-lived and scoped, for example:

- low-risk, scoped confirmation links
- capability tokens issued after exchanging durable magic-link tokens

### Durable magic-link tokens

Use durable magic-link tokens for flows that require a long-lived token to be sent to the customer, for example:

- Guest checkout order confirmation
- Guest checkout order review

The durable magic-link token should be exchanged for a short-lived JWT capability token before any sensitive operation is performed. The durable magic-link token itself should only be valid for the exchange operation and should **NOT** be valid for accessing the resource or performing any sensitive operation directly.

## Client exposure

In the happy path the token should live in HTTP-only cookies and never be exposed to client JavaScript. The exceptions are when the flow requires the browser to call backend endpoints directly, or when client-side navigation needs to hand a short-lived capability token to a same-origin route that stores it in an HTTP-only cookie and immediately redirects to a clean URL. In these cases it's fine to expose the short-lived token to JS memory or a temporary internal URL.

Examples include:

- Submitting a review through a capability link. Here we can fetch the review data server-side but the submit action requires someone to pass the capability token to the backend. If backend does not accept it via forwarded cookie, then the token must be exposed to JS memory to be sent in the request body or header.
- Starting a review flow from an authenticated account page. The browser may briefly navigate to a same-origin URL containing the short-lived review capability token so Next.js can set an HTTP-only cookie and redirect to the clean review URL.

## Next.js Responsibility

Next.js should not become a second auth system for these flows.

It can:

- receive a token-bearing URL
- exchange a magic token through the backend
- store a returned capability in an HTTP-only cookie
- redirect to a clean URL
- expose the capability to client JS memory if the flow requires it
- briefly receive a short-lived capability token in a same-origin URL for the sole purpose of setting an HTTP-only cookie and redirecting to a clean URL
- forward the capability to the backend during SSR

It should not:

- validate durable magic tokens
- verify capability JWTs for authorization decisions
- duplicate backend auth logic
- parse token payloads to decide access
- create server actions just to avoid exposing a token to JS memory

## Backend Responsibility

Backend should be the only system that validates durable magic tokens and verifies capability JWTs for authorization decisions. It should handle all sensitive operations and ensure that tokens are used according to their intended purpose.

It can:

- validate durable magic tokens
- create durable tokens for flows that require them
- sign and issue capability JWTs
- verify capability JWTs for authorization decisions
- handle sensitive operations based on the validated tokens

It should not:

- accept durable tokens for any operation other than the exchange for a capability token
- use durable tokens if JWT is viable for the flow
- return durable tokens from any endpoint. Durable tokens should only go to users via email or other secure channels, and should never be exposed in API responses.

## Client responsibility

Client-side code should handle tokens carefully and not store them longer than necessary. It should only use tokens for the intended purpose and avoid exposing them in logs or error messages.

It can:

- store short-lived tokens in memory for the duration of the flow
- make requests to the backend with the appropriate tokens

It should not:

- store tokens in local storage or other persistent storage
- expose tokens in logs, error messages, durable-token URLs, or unapproved URL flows
- use tokens for any purpose other than what they were issued for
