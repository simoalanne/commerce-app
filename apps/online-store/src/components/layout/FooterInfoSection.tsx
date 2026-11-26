import { Link } from "@/i18n/navigation";

import styles from "./Footer.module.css";

type FooterLink = {
  label: string;
  href: string;
};

type FooterInfoSectionProps = {
  label: string;
  links: FooterLink[];
};

export default function FooterInfoSection({ label, links }: FooterInfoSectionProps) {
  if (label.trim() === "" && links.length === 0) {
    return null;
  }

  return (
    <div className={styles.navSection}>
      <p className={styles.sectionTitle}>{label}</p>
      {links.map((link) => (
        <p key={link.href}>
          <Link href={link.href} className={styles.navLink} prefetch={false}>
            {link.label}
          </Link>
        </p>
      ))}
    </div>
  );
}
