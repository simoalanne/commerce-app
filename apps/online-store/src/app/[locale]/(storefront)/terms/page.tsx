import {
  createLegalDocumentMetadata,
  createLegalDocumentRoute,
} from "@/features/legal-documents/legalDocumentRoute";

export const generateMetadata = createLegalDocumentMetadata("TERMS_OF_SALE");
export default createLegalDocumentRoute("TERMS_OF_SALE");
