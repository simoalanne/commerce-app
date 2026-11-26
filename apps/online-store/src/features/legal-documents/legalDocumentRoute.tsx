import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ScrollHeader from "@/app/[locale]/HeaderScrollShell";
import { getServerTranslations } from "@/i18n/serverTranslations";
import { buildPageMetadata } from "@/metadata/buildPageMetadata";
import { getLegalDocumentByKey } from "@/server/getLegalDocumentByKey";
import type { DestructuredRouteParams, RouteParams } from "@/types";

import { getLegalDocumentPath, type LegalDocumentKey } from "./legalDocumentConfig";
import { LegalDocumentContent } from "./LegalDocumentContent";

import styles from "./LegalDocumentPage.module.css";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function renderLegalDocumentPage(
  key: LegalDocumentKey,
  params: DestructuredRouteParams,
) {
  const document = await getLegalDocumentByKey(key, params);

  if (!document) {
    notFound();
  }

  const t = await getServerTranslations(params, "legalDocument");

  return (
    <div className="storefrontPage">
      <ScrollHeader animated alwaysScrolled />
      <main className="storefrontSection storefrontLandingHeaderOffset">
        <article className={`storefrontNarrowRail ${styles.article}`}>
          <header className={styles.header}>
            <h1 className={styles.title}>{document.title}</h1>
          </header>

          <LegalDocumentContent
            content={document.content}
            lastUpdatedLabel={t("lastUpdated", {
              date: formatDate(new Date(document.updatedAt)),
            })}
          />
        </article>
      </main>
    </div>
  );
}

export const createLegalDocumentRoute = (key: LegalDocumentKey) => {
  return async ({ params }: RouteParams) => {
    return renderLegalDocumentPage(key, params);
  };
};

export async function generateLegalDocumentMetadata(
  key: LegalDocumentKey,
  params: DestructuredRouteParams,
): Promise<Metadata> {
  const { locale } = await params;
  const document = await getLegalDocumentByKey(key, params);

  if (!document) {
    return {};
  }

  return await buildPageMetadata({
    locale,
    title: document.title,
    description: document.title,
    pathname: getLegalDocumentPath(key),
  });
}

export const createLegalDocumentMetadata = (key: LegalDocumentKey) => {
  return async ({ params }: RouteParams): Promise<Metadata> => {
    return generateLegalDocumentMetadata(key, params);
  };
};
