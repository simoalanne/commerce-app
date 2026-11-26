import type { InferClientRequest } from "@rest-rpc/core";

import type { Api } from "@/api/client";

export type LegalDocumentKey = InferClientRequest<
  Api["legalDocuments"]["getByKey"]
>["params"]["key"];

type LegalDocumentConfig = {
  key: LegalDocumentKey;
  pathname: `/${string}`;
  footerLabelKey: "termsOfSale" | "returnsAndCancellation" | "privacyNotice" | "contactInformation";
};

const legalDocumentPathByKey: Record<LegalDocumentKey, `/${string}`> = {
  TERMS_OF_SALE: "/terms",
  RETURNS_AND_CANCELLATION: "/returns",
  PRIVACY_NOTICE: "/privacy",
  CONTACT_INFORMATION: "/company",
};

export const legalDocumentConfigs: readonly LegalDocumentConfig[] = [
  {
    key: "TERMS_OF_SALE",
    pathname: legalDocumentPathByKey.TERMS_OF_SALE,
    footerLabelKey: "termsOfSale",
  },
  {
    key: "RETURNS_AND_CANCELLATION",
    pathname: legalDocumentPathByKey.RETURNS_AND_CANCELLATION,
    footerLabelKey: "returnsAndCancellation",
  },
  {
    key: "PRIVACY_NOTICE",
    pathname: legalDocumentPathByKey.PRIVACY_NOTICE,
    footerLabelKey: "privacyNotice",
  },
  {
    key: "CONTACT_INFORMATION",
    pathname: legalDocumentPathByKey.CONTACT_INFORMATION,
    footerLabelKey: "contactInformation",
  },
];

export const getLegalDocumentPath = (key: LegalDocumentKey) => legalDocumentPathByKey[key];
