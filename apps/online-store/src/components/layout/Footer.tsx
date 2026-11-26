import Image from "next/image";

import { legalDocumentConfigs } from "@/features/legal-documents/legalDocumentConfig";
import { Link } from "@/i18n/navigation";
import { getServerTranslations } from "@/i18n/serverTranslations";
import createServerSideApiClient from "@/server/serverApiClient";
import type { RouteParams } from "@/types";

import FooterInfoSection from "./FooterInfoSection";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./Logo";

import styles from "./Footer.module.css";

type FooterLink = {
  label: string;
  href: string;
};

function FooterNavSection({ label, links }: { label: string; links: FooterLink[] }) {
  if (label.trim() === "" || links.length === 0) {
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

export default async function Footer({ params }: RouteParams) {
  const client = await createServerSideApiClient(params);
  const t = await getServerTranslations(params, "footer");
  const year = new Date().getFullYear();
  const tagline = t("tagline").trim();
  const paymentMethods = (await client.checkout.getPaymentMethods()).body;
  const legalLinks = legalDocumentConfigs.map((document) => ({
    label: t(`legalLinks.${document.footerLabelKey}`).trim(),
    href: document.pathname,
  }));
  const contactInformationLink = legalLinks.find((link) => link.href === "/company");
  const generalLinks: { label: string; href: string }[] = [];
  const infoLinks = legalLinks.filter((link) => link.href !== "/company");

  generalLinks.push({
    label: t("sections.contactUs").trim(),
    href: "/contact",
  });
  if (contactInformationLink) {
    generalLinks.push(contactInformationLink);
  }

  return (
    <footer className={`${styles.footer} storefrontSection`}>
      <div className={`${styles.container} storefrontRail`}>
        <div className={styles.brand}>
          <Logo variant="footer" color="dark" />
          {tagline !== "" ? <p className={styles.tagline}>{tagline}</p> : null}
        </div>

        <nav className={styles.nav} aria-label={t("footerNavigation")}>
          <FooterInfoSection label={t("sections.info").trim()} links={infoLinks} />
          <FooterNavSection label="Acme" links={generalLinks} />
        </nav>
      </div>
      {paymentMethods.length > 0 ? (
        <div className={`${styles.paymentMethods} storefrontRail`}>
          <div className={styles.paymentMethodsRow}>
            {paymentMethods.map((method, index) => (
              <Image
                key={`${method.id}-${index}`}
                src={method.imageUrl}
                alt={method.name}
                width={0}
                height={0}
                sizes="100vw"
                className={styles.paymentMethodLogo}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className={`${styles.footerBottom} storefrontRail`}>
        <div className={styles.year}>© {year} Acme</div>
        <div className={styles.bottomRightGroup}>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
