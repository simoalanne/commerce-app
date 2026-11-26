import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import styles from "./LandingMenuLinks.module.css";

type LinkProps = {
  animated?: boolean;
  onClick?: () => void;
};

export default function LandingMenuLinks({ animated, onClick }: LinkProps) {
  const t = useTranslations();

  const links = [
    {
      href: "/contact",
      label: t("header.contactUs"),
    },
  ];

  return (
    <>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`${styles.link} ${!animated ? styles.linkStatic : ""}`.trim()}
          onClick={onClick}
        >
          {animated ? (
            <span className={styles.linkLabelViewport}>
              <span className={styles.linkLabelTrack}>
                <span className={styles.linkLabelCopy}>{label}</span>
                <span
                  className={`${styles.linkLabelCopy} ${styles.linkLabelSecondary}`.trim()}
                  aria-hidden="true"
                >
                  {label}
                </span>
              </span>
            </span>
          ) : (
            <div className={styles.sidemenuLinksWrapper}>
              <span className={styles.sidemenuLink}>{label}</span>
            </div>
          )}
        </Link>
      ))}
    </>
  );
}
