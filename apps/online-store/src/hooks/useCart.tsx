"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CART_COOKIE_NAME,
  createCartCookieValue,
  parseCartCookieValue,
  serializeCartCookieValue,
} from "@/features/checkout/cartCookie";
import { type CartItems, getProductMaxOrderQuantity } from "@/features/checkout/cartState";
import type { ProductSummary } from "@/types/api";
import { getCookieStore } from "@/utils/cookieStore";

type CartContextValue = {
  hasHydrated: boolean;
  items: CartItems;
  updatedAt: number | null;
  addProduct: (product: ProductSummary) => void;
  replaceCart: (cart: { items: CartItems }) => Promise<void>;
  removeProduct: (sku: string) => void;
  removeAllOfProduct: (sku: string) => void;
  clear: () => void;
};

type CartProviderProps = {
  children: ReactNode;
};

type CartState = Pick<CartContextValue, "hasHydrated" | "items" | "updatedAt">;

const emptyCartState: CartState = {
  hasHydrated: false,
  items: {},
  updatedAt: null,
};
const CART_COOKIE_TTL_MS = 60 * 60 * 24 * 30 * 1000;

const CartContext = createContext<CartContextValue | null>(null);

async function readPersistedCart() {
  const cookie = await getCookieStore().get(CART_COOKIE_NAME);
  return parseCartCookieValue(cookie?.value);
}

function clearPersistedCart() {
  return getCookieStore().delete(CART_COOKIE_NAME);
}

function writePersistedCart(state: Pick<CartState, "items" | "updatedAt">) {
  return getCookieStore().set({
    name: CART_COOKIE_NAME,
    value: serializeCartCookieValue(
      createCartCookieValue({
        items: state.items,
        updatedAt: state.updatedAt ?? undefined,
      }),
    ),
    expires: Date.now() + CART_COOKIE_TTL_MS,
  });
}

async function syncCartCookie(state: Pick<CartState, "items" | "updatedAt">) {
  try {
    if (Object.keys(state.items).length === 0) {
      await clearPersistedCart();
    } else {
      await writePersistedCart(state);
    }
  } catch (error) {
    // The in-memory cart stays correct even if persistence fails
    // (e.g. cookies blocked); the user can keep shopping in this session.
    console.error("Failed to persist cart cookie", error);
  }
}

function getHydratedCartState() {
  return readPersistedCart().then((persistedCart) =>
    persistedCart
      ? {
          hasHydrated: true,
          items: persistedCart.items,
          updatedAt: persistedCart.updatedAt ?? null,
        }
      : {
          ...emptyCartState,
          hasHydrated: true,
        },
  );
}

export function CartProvider({ children }: CartProviderProps) {
  const [cart, setCart] = useState<CartState>(emptyCartState);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateCart(force = false) {
      const hydratedCart = await getHydratedCartState();
      if (isCancelled) {
        return;
      }

      setCart((current) => {
        const hasClientChanges =
          current.updatedAt !== null || Object.keys(current.items).length > 0;

        if (force || !hasClientChanges) {
          return hydratedCart;
        }

        if (current.hasHydrated) {
          return current;
        }

        // A click can land before this async hydration finishes. Merge the
        // persisted items underneath the pre-hydration changes so the sync
        // effect doesn't overwrite the stored cart with only the new clicks.
        const mergedItems = { ...hydratedCart.items };
        for (const [sku, item] of Object.entries(current.items)) {
          mergedItems[sku] = {
            ...item,
            quantity: (hydratedCart.items[sku]?.quantity ?? 0) + item.quantity,
          };
        }

        return {
          ...current,
          items: mergedItems,
          hasHydrated: true,
        };
      });
    }

    void hydrateCart();

    const handlePageShow = () => {
      void hydrateCart(true);
    };
    const handlePopState = () => {
      void hydrateCart(true);
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);

    return () => {
      isCancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Persisting here keeps the state updaters pure (React can invoke updaters
  // more than once, e.g. in StrictMode, which used to double-write the cookie).
  // Skipping before hydration avoids clearing the cookie the hydration effect
  // is about to read.
  useEffect(() => {
    if (!cart.hasHydrated) {
      return;
    }

    void syncCartCookie(cart);
  }, [cart]);

  const addProduct = useCallback((product: ProductSummary) => {
    setCart((current) => {
      const maxQuantity = getProductMaxOrderQuantity(product);
      const currentQuantity = current.items[product.sku]?.quantity ?? 0;
      if (currentQuantity >= maxQuantity) {
        return current;
      }

      return {
        ...current,
        items: {
          ...current.items,
          [product.sku]: {
            quantity: currentQuantity + 1,
            unitPriceCents: product.priceCents,
          },
        },
        updatedAt: Date.now(),
      };
    });
  }, []);

  const replaceCart = useCallback(async (nextCart: { items: CartItems }) => {
    const hasItems = Object.keys(nextCart.items).length > 0;
    const nextState = {
      items: nextCart.items,
      updatedAt: hasItems ? Date.now() : null,
    };

    setCart((current) => ({
      ...nextState,
      hasHydrated: current.hasHydrated,
    }));

    // Written directly (not left to the sync effect) so callers can await
    // persistence before navigating to pages that read the cookie server-side.
    await syncCartCookie(nextState);
  }, []);

  const removeProduct = useCallback((sku: string) => {
    setCart((current) => {
      const currentItem = current.items[sku];
      const currentQuantity = currentItem?.quantity;
      if (!currentQuantity) {
        return current;
      }

      const nextItems = { ...current.items };
      if (currentQuantity <= 1) {
        delete nextItems[sku];
      } else {
        nextItems[sku] = {
          ...currentItem,
          quantity: currentQuantity - 1,
        };
      }

      return {
        ...current,
        items: nextItems,
        updatedAt: Object.keys(nextItems).length > 0 ? Date.now() : null,
      };
    });
  }, []);

  const removeAllOfProduct = useCallback((sku: string) => {
    setCart((current) => {
      if (!current.items[sku]) {
        return current;
      }

      const nextItems = { ...current.items };
      delete nextItems[sku];

      return {
        ...current,
        items: nextItems,
        updatedAt: Object.keys(nextItems).length > 0 ? Date.now() : null,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setCart((current) => ({
      ...emptyCartState,
      hasHydrated: current.hasHydrated,
    }));
  }, []);

  const value = useMemo(
    () => ({
      ...cart,
      addProduct,
      replaceCart,
      removeProduct,
      removeAllOfProduct,
      clear,
    }),
    [cart, addProduct, replaceCart, removeProduct, removeAllOfProduct, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);

  if (!cart) {
    throw new Error("useCart must be used within CartProvider");
  }

  return cart;
}
