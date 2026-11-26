import { Link } from "@/i18n/navigation";

import styles from "./Logo.module.css";

type LogoProps = {
  variant: "footer" | "header";
  color: "white" | "dark";
  href?: string;
  arialabel?: string;
};

// A text wordmark until the project has a logo.
export default function Logo({ variant, color, href = "/", arialabel }: LogoProps) {
  const wordmark = (
    <span className={`${styles.wordmark} ${styles[variant]} ${styles[color]}`}>Acme</span>
  );

  if (variant === "footer") {
    return <span className={styles.footerLogo}>{wordmark}</span>;
  }

  return (
    <Link href={href} className={styles.headerLink} aria-label={arialabel}>
      {wordmark}
    </Link>
  );
}
