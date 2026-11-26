import {
  createLegalDocumentMetadata,
  createLegalDocumentRoute,
} from "@/features/legal-documents/legalDocumentRoute";

export const generateMetadata = createLegalDocumentMetadata("ORDER_AND_DELIVERY_TERMS");
export default createLegalDocumentRoute("ORDER_AND_DELIVERY_TERMS");
