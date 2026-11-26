import {
  createLegalDocumentMetadata,
  createLegalDocumentRoute,
} from "@/features/legal-documents/legalDocumentRoute";

export const generateMetadata = createLegalDocumentMetadata("CONTACT_INFORMATION");
export default createLegalDocumentRoute("CONTACT_INFORMATION");
