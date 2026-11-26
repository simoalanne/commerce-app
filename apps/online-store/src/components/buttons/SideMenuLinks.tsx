"use client";

import { Building2, Home, Mail, ShoppingBasket } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";

import { Link } from "@/i18n/navigation";

import styles from "./SideMenuLinks.module.css";

interface LinkProps {
  className?: string;
  linkClassName?: string;
  activeLinkClassName?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function SideMenuLinks({
  className,
  linkClassName = "",
  style,
  onClick,
}: LinkProps) {
  const t = useTranslations();

  const links = [
    {
      href: "/",
      label: t("header.home"),
      icon: <Home size={20} />,
    },
    {
      href: "/vendors",
      label: t("header.vendors"),
      icon: <Building2 size={20} />,
    },
    {
      href: "/products",
      label: t("header.products"),
      icon: <ShoppingBasket size={20} />,
    },
    {
      href: "/contact",
      label: t("header.contactUs"),
      icon: <Mail size={20} />,
    },
  ];

  return (
    <div className={className} style={style}>
      {links.map(({ href, label, icon }) => (
        <Link key={href} href={href} className={linkClassName} onClick={onClick}>
          <div className={styles.linkContent}>
            {icon}
            <span>{label}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
