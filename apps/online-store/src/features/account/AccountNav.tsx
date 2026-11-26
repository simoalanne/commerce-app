"use client";

import { House, LogOutIcon, MapPinned, ReceiptText, Store } from "lucide-react";
import { useTranslations } from "next-intl";

import { useClerk, useUser } from "@/features/auth/clerk";
import { Link, usePathname } from "@/i18n/navigation";

import styles from "./AccountNav.module.css";

export function AccountNav() {
  const t = useTranslations("accountNav");
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const displayName = user?.fullName ?? user?.firstName ?? t("memberFallback");
  const memberSince =
    user?.createdAt != null ? new Date(user.createdAt).getFullYear().toString() : null;

  const links = [
    {
      href: "/account",
      icon: House,
      labelKey: "accountDetails",
    },
    {
      href: "/account/orders",
      icon: ReceiptText,
      labelKey: "orderHistory",
    },
    {
      href: "/account/addresses",
      icon: MapPinned,
      labelKey: "savedAddresses",
    },
    {
      href: "/",
      icon: Store,
      labelKey: "backToShop",
    },
  ] as const; // as const so t(labelKey) is properly typed and not just string

  return (
    <nav className={styles.nav} aria-label={t("accountNavigation")}>
      <div className={styles.profileCard}>
        <div className={styles.avatar}>{displayName.slice(0, 1).toUpperCase()}</div>
        <div className={styles.profileText}>
          <p className={styles.profileName}>{displayName}</p>
          <p className={styles.profileMeta}>
            {memberSince ? t("memberSince", { year: memberSince }) : t("accountArea")}
          </p>
        </div>
      </div>

      <div className={styles.links}>
        {links.map(({ href, icon: Icon, labelKey }) => {
          const isActive =
            pathname === href || (href !== "/account" && pathname.startsWith(`${href}/`));

          return (
            <Link
              key={href}
              href={href}
              className={`${styles.link} ${isActive ? styles.linkActive : ""}`.trim()}
            >
              <Icon className={styles.icon} />
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`${styles.link} ${styles.signOutLink}`}
          onClick={() => signOut()}
        >
          <LogOutIcon className={styles.icon} />
          <span>{t("signOut")}</span>
        </button>
      </div>
    </nav>
  );
}
