type StoredCookie = {
  name: string;
  value: string;
};

type CookieStoreAdapter = {
  get: (name: string) => Promise<StoredCookie | null>;
  set: (options: { name: string; value: string; expires: number }) => Promise<void>;
  delete: (name: string) => Promise<void>;
};

export const getCookieStore = (): CookieStoreAdapter =>
  window.cookieStore
    ? {
        async get(name: string) {
          const cookie = await window.cookieStore.get(name);
          return cookie?.value ? { name, value: cookie.value } : null;
        },
        async set({ name, value, expires }: { name: string; value: string; expires: number }) {
          await window.cookieStore.set({
            name,
            value,
            expires,
            sameSite: "lax",
          });
        },
        async delete(name: string) {
          await window.cookieStore.delete(name);
        },
      }
    : {
        // Cookie Store is widely available but on some browsers like Safari it can reasonably not exist,
        // so we provide the small fallback surface we actually need.
        async get(name: string) {
          const value = document.cookie
            .split("; ")
            .find((part) => part.startsWith(`${name}=`))
            ?.slice(name.length + 1);

          if (!value) {
            return null;
          }

          try {
            return { name, value: decodeURIComponent(value) };
          } catch {
            // Cookies written before values were URI-encoded (or by other
            // sources) may contain stray "%" sequences; return them as-is.
            return { name, value };
          }
        },
        async set({ name, value, expires }: { name: string; value: string; expires: number }) {
          const maxAge = Math.max(0, Math.floor((expires - Date.now()) / 1000));
          // URI-encode so values with ";", "," or spaces (e.g. JSON) survive
          // document.cookie serialization and intermediate proxies.
          document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
        },
        async delete(name: string) {
          document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
        },
      };
