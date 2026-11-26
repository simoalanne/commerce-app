"use client";

import { useCallback } from "react";

import type { ProductSummary } from "@/types/api";

// Readable hook type: options for the animation
type UseFlyToCartOptions = {
  // Enable the fly-to-cart animation
  flyToCart?: boolean;
  // Image URL to use as the animated clone (if provided)
  imgUrl?: string | undefined;
  // DOM id of the element the clone will fly to (string)
  targetId?: string;
  // Product represented by the animation (used as image alt text)
  product?: ProductSummary;
};

/**
 * useFlyToCartAnimation
 * ---------------------
 * Returns a function `animate(anchor)` which triggers a "fly to cart"
 * animation. The animation creates a temporary DOM element (an image or
 * a small circle), positions it on top of the button and animates it
 * towards the cart trigger element. The clone is removed from the DOM
 * after the animation completes.
 *
 * This hook is a no-op when `flyToCart` is `false` or when `anchor` is
 * `null`/`undefined`.
 *
 * Usage (simplified):
 * const animate = useFlyToCartAnimation({ flyToCart: true, imgUrl, product });
 * animate(buttonRef.current);
 */
export default function useFlyToCartAnimation({
  flyToCart = false,
  imgUrl,
  targetId = "storefront-cart-trigger",
  product,
}: UseFlyToCartOptions) {
  // `animate` is the function invoked with the button's DOM element.
  // The `anchor` parameter is the element the animation starts from.

  return useCallback(
    (anchor?: HTMLElement | null) => {
      // Safety check: if the animation is disabled or there's no anchor,
      // do nothing.
      if (!flyToCart || !anchor) return;

      try {
        // Find the cart trigger in the DOM. This is the animation target.
        const target = document.getElementById(targetId);
        if (!target) return; // jos kohde puuttuu, lopetetaan.

        // Get source and target rectangles to compute movement distance.
        const sourceRect = anchor.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        // Create the clone: if `imgUrl` is provided create an <img>,
        // otherwise create a small circular placeholder div. This element
        // will be animated.
        let clone: HTMLElement;
        if (imgUrl) {
          const img = new Image();
          img.src = imgUrl;
          // Use product name as alt if exists
          img.alt = product?.name ?? "";
          clone = img;
        } else {
          const placeholder = document.createElement("div");
          // Yksinkertainen visuaalinen tyyli placeholderille
          placeholder.style.background = "rgba(0,0,0,0.08)";
          placeholder.style.borderRadius = "50%";
          clone = placeholder;
        }

        // Initialize styles so the clone is positioned over the button.
        // Based on the original size, shrink the element to a small
        // circular presentation centered on the button.
        const styles: Partial<CSSStyleDeclaration> = {
          position: "fixed",
          left: `${sourceRect.left}px`,
          top: `${sourceRect.top}px`,
          width: `${sourceRect.width}px`,
          height: `${sourceRect.height}px`,
          zIndex: "9999",
          pointerEvents: "none",
          transformOrigin: "center",
          opacity: "1",
        };

        // Compute the clone's final small size (a small circle centered
        // on the button).
        const smallSize = Math.max(60, Math.min(sourceRect.width, sourceRect.height) * 0.5);
        const left = sourceRect.left + (sourceRect.width - smallSize) / 2;
        const top = sourceRect.top + (sourceRect.height - smallSize) / 2;
        styles.left = `${left}px`;
        styles.top = `${top}px`;
        styles.width = `${smallSize}px`;
        styles.height = `${smallSize}px`;
        styles.borderRadius = "50%";
        styles.overflow = "hidden";

        // Apply styles to the clone and ensure the image scales correctly
        Object.assign(clone.style, styles);
        if (clone instanceof HTMLImageElement) {
          // Cover keeps the round clone cropped instead of squashed
          clone.style.objectFit = "cover";
        }

        // Append the clone to the body; only after this will
        // getBoundingClientRect return correct coordinates.
        document.body.appendChild(clone);

        // Calculate the centers of the clone and target to determine the
        // required translateX and translateY.
        const cloneRect = clone.getBoundingClientRect();
        const sourceCenterX = cloneRect.left + cloneRect.width / 2;
        const sourceCenterY = cloneRect.top + cloneRect.height / 2;
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;
        const translateX = targetCenterX - sourceCenterX;
        const translateY = targetCenterY - sourceCenterY;

        // Animations use a requestAnimationFrame chain so browser layout
        // and rendering stay in sync and transitions run smoothly.
        requestAnimationFrame(() => {
          // Fallback timer in case `transitionend` doesn't fire for some
          // reason.
          let fallbackTimer: number | undefined;

          // Function that performs the second phase: fly to the cart and
          // remove the clone afterwards.
          const toCart = () => {
            if (fallbackTimer) window.clearTimeout(fallbackTimer);

            // Set a longer transition for the flight and fade the opacity
            clone.style.transition = "transform 700ms cubic-bezier(.5,.3,.2,1), opacity 400ms";
            clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.18)`;
            clone.style.opacity = "0.35";

            // Remove the clone from the DOM after the move.
            const cleanup = () => {
              clone.parentElement?.removeChild(clone);
            };

            // Listen for `transitionend` and remove the clone once. Also
            // set a timeout as a safeguard if the event doesn't fire.
            clone.addEventListener("transitionend", cleanup, { once: true });
            window.setTimeout(cleanup, 900);
          };

          // Phase 1: small pop — a short transition so the user sees
          // feedback for the button press.
          clone.style.transition = "transform 110ms cubic-bezier(.2,.8,.2,1)";
          requestAnimationFrame(() => {
            clone.style.transform = `translate(0px, -20px) scale(0.92)`;
          });

          // When the pop transition ends, start the actual flight.
          const onPopEnd = (ev: TransitionEvent) => {
            // Ensure the `transitionend` was for the transform property
            // (some browsers may emit other property names).
            const prop = (ev.propertyName || "").toLowerCase();
            if (!prop.includes("transform")) return;
            clone.removeEventListener("transitionend", onPopEnd as EventListener);
            toCart();
          };

          clone.addEventListener("transitionend", onPopEnd as EventListener);

          // Safety fallback if `transitionend` does not fire
          fallbackTimer = window.setTimeout(() => {
            clone.removeEventListener("transitionend", onPopEnd as EventListener);
            toCart();
          }, 250);
        });
      } catch (err) {
        // Debug logging for errors; in production you may want to handle
        // or log errors differently.
        console.debug("animation error", err);
      }
    },
    [flyToCart, imgUrl, product, targetId],
  );
}
