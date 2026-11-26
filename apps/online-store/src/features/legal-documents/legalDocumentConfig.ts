import type { InferClientRequest } from "@rest-rpc/core";

import type { Api } from "@/api/client";

export type LegalDocumentKey = InferClientRequest<
  Api["legalDocuments"]["getByKey"]
>["params"]["key"];

type LegalDocumentConfig = {
  key: LegalDocumentKey;
  pathname: `/${string}`;
  footerLabelKey:
    | "orderAndDeliveryTerms"
    | "returnsAndCancellation"
    | "privacyNotice"
    | "contactInformation";
};

const legalDocumentPathByKey: Record<LegalDocumentKey, `/${string}`> = {
  ORDER_AND_DELIVERY_TERMS: "/terms",
  RETURNS_AND_CANCELLATION: "/returns",
  PRIVACY_NOTICE: "/privacy",
  CONTACT_INFORMATION: "/company",
};

export const legalDocumentConfigs: readonly LegalDocumentConfig[] = [
  {
    key: "ORDER_AND_DELIVERY_TERMS",
    pathname: legalDocumentPathByKey.ORDER_AND_DELIVERY_TERMS,
    footerLabelKey: "orderAndDeliveryTerms",
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
