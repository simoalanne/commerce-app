"use client";

import { Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useScrollDetection } from "@/hooks/useScrollDetection";
import { usePathname } from "@/i18n/navigation";

import { FloatingAuthControls } from "../auth/FloatingAuthControls";
import MenuLinks from "../buttons/MenuLinks";
import SearchModal from "../modals/search-modal/SearchModal";
import { CartButton } from "./CartButton";
import SideBar from "./SideBar";
import SideMenu from "./SideMenu";
import { SiteHeader } from "./SiteHeader";

import styles from "./SiteHeader.module.css";

export function StorefrontHeader() {
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const { isScrolled } = useScrollDetection();
  const pathname = usePathname();

  const transparentPaths = ["/contact"];

  const isTransparentHeaderPage =
    pathname === "/" ||
    transparentPaths.some((p) => pathname.endsWith(p)) ||
    (pathname.includes("/vendors/") && !pathname.endsWith("/vendors"));

  const showScrolledIcons = !isTransparentHeaderPage || isScrolled;
  const iconScrolledClass = showScrolledIcons ? styles.scrolledIcon : "";
  const iconColor = "white";

  return (
    <>
      <SiteHeader
        variant={isTransparentHeaderPage ? "transparent" : "solid"}
        logoAriaLabel={t("header.arialabels.toLandingPage")}
        withSpacer
        leftSlot={
          <SideBar
            side="left"
            open={menuOpen}
            onOpenChange={setMenuOpen}
            triggerLabel={t("header.categories")}
            title={t("header.categories")}
            trigger={<Menu color={iconColor} style={{ transition: "color 300ms ease" }} />}
          >
            <SideMenu onNavigate={() => setMenuOpen(false)} />
          </SideBar>
        }
        searchSlot={
          <button
            type="button"
            className={`${styles.searchBtn} ${iconScrolledClass}`}
            onClick={() => setIsSearchModalOpen(true)}
            aria-label={t("header.search")}
          >
            <Search />
          </button>
        }
        navSlot={<MenuLinks linkClassName={styles.link} className={styles.centerLinks} animated />}
        rightSlot={
          <>
            <div className={`${styles.iconButton} ${iconScrolledClass}`}>
              <CartButton />
            </div>
            <div className={`${styles.iconButton} ${iconScrolledClass}`}>
              <FloatingAuthControls />
            </div>
          </>
        }
      />
      <SearchModal open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen} />
    </>
  );
}
