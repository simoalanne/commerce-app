import "server-only";
import type { InferClientResponse } from "@rest-rpc/core";
import { cache } from "react";

import type { Api } from "@/api/client";
import type { LegalDocumentKey } from "@/features/legal-documents/legalDocumentConfig";
import createServerSideApiClient from "@/server/serverApiClient";
import type { DestructuredRouteParams } from "@/types";

export type LegalDocument = InferClientResponse<Api["legalDocuments"]["getByKey"]>["body"];

export const getLegalDocumentByKey = cache(
  async (key: LegalDocumentKey, params: DestructuredRouteParams): Promise<LegalDocument | null> => {
    const client = await createServerSideApiClient(params);

    try {
      return (await client.legalDocuments.getByKey({ params: { key } })).body;
    } catch {
      return null;
    }
  },
);
