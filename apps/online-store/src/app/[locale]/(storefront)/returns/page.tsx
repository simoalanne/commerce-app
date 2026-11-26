import {
  createLegalDocumentMetadata,
  createLegalDocumentRoute,
} from "@/features/legal-documents/legalDocumentRoute";

export const generateMetadata = createLegalDocumentMetadata("RETURNS_AND_CANCELLATION");
export default createLegalDocumentRoute("RETURNS_AND_CANCELLATION");
