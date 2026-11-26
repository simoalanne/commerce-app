import {
  createLegalDocumentMetadata,
  createLegalDocumentRoute,
} from "@/features/legal-documents/legalDocumentRoute";

export const generateMetadata = createLegalDocumentMetadata("PRIVACY_NOTICE");
export default createLegalDocumentRoute("PRIVACY_NOTICE");
