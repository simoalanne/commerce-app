# Checkout Payment Tradeoffs

Last updated: 2026-07-29

## Purpose

This document explains the current checkout/payment tradeoffs in the online store, why they exist, when they may become problematic, and what the likely evolution paths are.

This is not a perfect-architecture document. It is a record of the current practical choice and its known risks.

## Current Model

Today the checkout flow is optimized for implementation simplicity and reasonable stock safety:

- create the order when payment starts
- reserve stock when payment starts
- mark the order as paid when payment is confirmed
- expire abandoned pending orders after a timeout with the persisted `expirePendingOrder` job
- reconcile rare late-paid cases from `EXPIRED` back to `PAID` by committing as much stock as possible and recording any item-level `uncommitted_quantity` shortfall

This model is stricter than a pure "commit only on paid" flow because it tries to protect limited stock before payment finishes to avoid overselling but it is not as complex as a full checkout-session architecture with strong backend state and retry rules.

## What feels awkward about this model?

The system supports multiple payment providers with materially different payment lifecycles. Paytrail is the active online-store payment path right now; Stripe exists in the codebase but is not currently the main storefront payment flow.

- Stripe exposes a stronger payment object lifecycle
- Stripe payments can be canceled explicitly by backend logic
- Stripe fits stateless checkout assumptions better
- Paytrail behaves more like "here is a hosted payment URL"
- Paytrail gives weaker guarantees around whether a canceled-looking flow is truly dead. Payment can be cancelled by the user meaning backend could receive a callback for a canceled path but yet customer can still actually go back to that URL and complete payment successfully later.

Because of this, checkout behavior is constrained by the weakest reliable provider semantics, not by the nicest ones.

## Main Tradeoff

The real business/engineering tradeoff is:

### Option A: Reserve stock before payment finishes

Benefits:

- protects scarce stock better
- reduces overselling risk
- lets only one concurrent checkout reserve the last units

Costs:

- unfinished payments can tie up stock
- with Paytrail, a user may effectively block their own stock through an older payment flow thats still reserving stock even if they "cancel" it
- payment lifecycle edge cases become harder to model
- backend cleanup and reconciliation matter more

### Option B: Do not reserve stock, only commit on paid

Benefits:

- much simpler lifecycle
- no stock-release logic for canceled or abandoned payment attempts
- Paytrail integration becomes easier to reason about
- accidental cancel / back-navigation issues matter much less

Costs:

- overselling risk increases
- paid orders may need refund/manual handling if stock is gone by the time payment succeeds
- this becomes especially painful really quick if order volume or stock pressure increases faster than expected

## Why The Current Choice Exists

The current choice prefers the stricter stock-protection model because:

- order volume is expected to be low enough initially
- stock may matter enough that some reservation behavior is worth it
- the implementation is still relatively simple compared to a full checkout-session architecture
- if this turns out to be the wrong tradeoff, moving toward "commit only on paid" flow is much easier direction than vice versa

In other words: this is not a forever decision. It is a defensible starting point.

## Important Assumptions

The current model is most likely to work acceptably when:

- order volume is low or moderate
- stock is usually not extremely tight
- most customers either complete payment quickly or abandon infrequently
- it is rare for the same customer to repeatedly cancel and retry hosted payment flows
- rare manual refunds or reconciliation follow-up are operationally acceptable

## When It Can Become Problematic

This model should be revisited if any of these start happening regularly:

- customers frequently get blocked by their own previous payment attempts
- stock is moving fast enough that reservation windows create noticeable friction
- Paytrail lifecycle quirks start causing support issues
- late payment reconciliation becomes common rather than rare
- manual refunds become operational noise
- pending-order expiry starts creating too many real-world edge cases

## Why Paytrail Cancel Is Not A Strong Rule

A key constraint with Paytrail is that user-facing "cancel" behavior does not necessarily mean the hosted payment flow is permanently dead in the same strong sense as a Stripe payment intent cancellation.

That means any logic that assumes "cancel means this payment can never succeed now" should be treated with caution.

This is why some apparently simple ideas, such as releasing stock immediately on explicit Paytrail cancel, may actually encode the wrong invariant for the provider.

## Evolution Paths

The current model preserves two plausible future directions.

### Evolve upward: checkout sessions / stronger backend state

This direction makes sense if the real pain is lifecycle control.

Likely characteristics:

- backend-owned checkout session or draft order
- explicit payment-attempt state
- retry rules for the same order snapshot
- clearer invalidation rules when pricing, promo code, or cart contents change

This is the more complex but more controlled path.

### Evolve downward: commit on paid

This direction makes sense if the real pain is provider lifecycle complexity and stock reservations are not worth it.

Likely characteristics:

- do not reserve stock before payment succeeds
- validate stock before payment creation, but do not hold it. Perhaps add simple heuristics like how many recent pending orders exists targeting the same products or not allow new pending orders if stock is already fully reserved by pending orders.
- commit stock only after paid confirmation
- refund or manually resolve rare successful payments that cannot be fulfilled

This is the simpler but less strict inventory path.
