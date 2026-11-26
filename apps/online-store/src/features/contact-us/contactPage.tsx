import ContactFormPage from "@/features/contact-forms/ContactFormPage";
import { getServerTranslations } from "@/i18n/serverTranslations";
import type { RouteParams } from "@/types";

export default async function ContactPage({ params }: RouteParams) {
  const t = await getServerTranslations(params, "contactUsPage");

  return (
    <ContactFormPage
      params={params}
      heroImageId="contact-us-hero-img"
      heroTitle={t("heroTitle")}
      heroSubtitle={t("heroSubtitle")}
      title={t("title")}
      description={
        <>
          <p>{t("lead")}</p>
          <p>{t("body")}</p>
        </>
      }
      formId="contact-form"
      submissionType="contact"
    />
  );
}
