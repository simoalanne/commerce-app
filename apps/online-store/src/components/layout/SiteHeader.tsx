"use client";

import type { ReactNode } from "react";

import { useScrollDetection } from "@/hooks/useScrollDetection";

import Logo from "./Logo";

import styles from "./SiteHeader.module.css";

type SiteHeaderProps = {
  /** "transparent" = starts transparent, becomes solid on scroll (landing/storefront).
   *  "solid" = always solid brand background (checkout/account). */
  variant?: "transparent" | "solid";

  /** Left slot — typically a sidebar menu trigger. Hidden on desktop (≥1124px). */
  leftSlot?: ReactNode;

  /** Search slot — displayed on both mobile (next to leftSlot) and desktop (next to rightSlot). */
  searchSlot?: ReactNode;

  /** Address slot — shown on desktop only, between logo and nav. */
  addressSlot?: ReactNode;

  /** Center/nav slot — typically navigation links. Hidden on mobile, shown on desktop. */
  navSlot?: ReactNode;

  /** Right slot — typically cart, auth, search, or a return link. */
  rightSlot?: ReactNode;

  /** Override the default logo with a custom node (e.g. for per-page logo destinations). */
  logoSlot?: ReactNode;

  /** Where the logo links to. Defaults to "/". Ignored when logoSlot is provided. */
  logoHref?: string;

  /** Aria label for the logo link. Ignored when logoSlot is provided. */
  logoAriaLabel?: string;

  /** If true, render a spacer div below the header to prevent content overlap.
   *  Useful when header is position: fixed (transparent mode). */
  withSpacer?: boolean;

  /** If true, forces the scrolled state (e.g. solid background) even if background="transparent". */
  forceScrolled?: boolean;

  /** If true, aligns the logo to the left on mobile instead of centering it. */
  leftAlignedLogo?: boolean;
};

export function SiteHeader({
  variant = "solid",
  leftSlot,
  searchSlot,
  addressSlot,
  navSlot,
  rightSlot,
  logoSlot,
  logoHref = "/",
  logoAriaLabel,
  withSpacer = false,
  forceScrolled = false,
  leftAlignedLogo = false,
}: SiteHeaderProps) {
  const { isScrolled } = useScrollDetection();
  const isTransparent = variant === "transparent";

  const headerClasses = [
    styles.header,
    isTransparent ? styles.transparent : styles.solid,
    isTransparent && (isScrolled || forceScrolled) ? styles.scrolled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <header className={headerClasses}>
        <div className={`${styles.inner} ${addressSlot ? styles.hasAddress : ""}`.trim()}>
          {leftSlot && <div className={styles.leftSlot}>{leftSlot}</div>}

          {searchSlot && <div className={styles.searchSlot}>{searchSlot}</div>}

          <div
            className={`${styles.logoSlot} ${leftAlignedLogo ? styles.leftAlignedLogo : ""}`.trim()}
          >
            {logoSlot ?? (
              <Logo variant="header" color="white" href={logoHref} arialabel={logoAriaLabel} />
            )}
          </div>

          {addressSlot && <div className={styles.addressSlot}>{addressSlot}</div>}

          {navSlot && <div className={styles.navSlot}>{navSlot}</div>}

          {rightSlot && <div className={styles.rightSlot}>{rightSlot}</div>}
        </div>
      </header>
      {withSpacer && <div aria-hidden="true" className={styles.headerSpacer} />}
    </>
  );
}
