"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { FloatingAuthControls } from "@/components/auth/FloatingAuthControls";
import LandingMenuLinks from "@/components/landing/LandingMenuLinks";
import { CartButton } from "@/components/layout/CartButton";
import Logo from "@/components/layout/Logo";
import SideBar from "@/components/layout/SideBar";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useScrollDetection } from "@/hooks/useScrollDetection";
import { usePathname } from "@/i18n/navigation";

import styles from "@/components/layout/SiteHeader.module.css";

type ScrollHeaderProps = {
  alwaysScrolled?: boolean;
  animated?: boolean;
  onClick?: () => void;
};

export default function ScrollHeader({ alwaysScrolled, animated, onClick }: ScrollHeaderProps) {
  const { isScrolled } = useScrollDetection();
  const pathname = usePathname();
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);

  const isLandingPage = pathname === "/";
  const isContactUsPage = pathname.includes("contact");

  const showScrolledIcons = (!isLandingPage && !isContactUsPage) || isScrolled;

  const iconScrolledClass = showScrolledIcons ? styles.scrolledIcon : "";

  return (
    <SiteHeader
      variant="transparent"
      forceScrolled={alwaysScrolled}
      logoSlot={
        <Logo
          variant="header"
          color="white"
          href="/"
          arialabel={t("header.arialabels.toLandingPage")}
        />
      }
      leftSlot={
        <SideBar
          side="left"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          triggerLabel={t("header.categories")}
          title={t("header.categories")}
          trigger={<Menu color="white" style={{ transition: "color 300ms ease" }} />}
        >
          <div className={styles.sidebarMenuLinks}>
            <LandingMenuLinks onClick={onClick} />
          </div>
        </SideBar>
      }
      navSlot={<LandingMenuLinks animated={animated} onClick={onClick} />}
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
  );
}
