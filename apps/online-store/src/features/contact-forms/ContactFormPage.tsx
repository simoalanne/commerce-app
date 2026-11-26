import Image from "next/image";
import type { ReactNode } from "react";
import { FaEnvelope } from "react-icons/fa";

import ScrollHeader from "@/app/[locale]/HeaderScrollShell";
import { getServerTranslations } from "@/i18n/serverTranslations";
import type { DestructuredRouteParams } from "@/types";

import ContactSubmissionForm from "./ContactSubmissionForm";

import styles from "./ContactFormPage.module.css";

type ContactFormPageProps = {
  params: DestructuredRouteParams;
  heroImageId: string;
  heroTitle: string;
  heroSubtitle?: string;
  title: string;
  description: ReactNode;
  formId: string;
  submissionType: "contact" | "vendorApplication";
};

export default async function ContactFormPage({
  params,
  heroImageId,
  heroTitle,
  heroSubtitle,
  title,
  description,
  formId,
  submissionType,
}: ContactFormPageProps) {
  const t = await getServerTranslations(params, "contactUsPage");

  return (
    <>
      <ScrollHeader animated />
      <div className={`heroImageFrame ${styles.heroImg}`}>
        <Image
          src={`${process.env.NEXT_PUBLIC_ASSETS_URL}/images/${heroImageId}`}
          alt={heroTitle}
          fill
          priority
          fetchPriority="high"
          quality={60}
          sizes="100vw"
          className={styles.heroBackgroundImage}
        />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={`heroImageOverlayContent ${styles.heroContent}`}>
          <div className={styles.heroText}>
            <h1>{heroTitle}</h1>
            {heroSubtitle && <p className={styles.heroSubtitle}>{heroSubtitle}</p>}
          </div>
        </div>
      </div>
      <main className="storefrontSection">
        <section className={`storefrontRail ${styles.content}`}>
          <div className={styles.info}>
            <h2 className={styles.title}>{title}</h2>
            <div className={styles.description}>{description}</div>
            <div className={styles.divider} />
            <ul className={styles.contactList}>
              <li className={styles.contactItem}>
                <FaEnvelope className={styles.icon} />
                <a className={styles.mail} href={`mailto:${t("contact.email")}`}>
                  {t("contact.email")}
                </a>
              </li>
            </ul>
          </div>

          <aside className={styles.formWrap} id={formId}>
            <ContactSubmissionForm submissionType={submissionType} />
          </aside>
        </section>
      </main>
    </>
  );
}
