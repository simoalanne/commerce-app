import type { EnvConfig } from "#src/config.ts";
import type { OrderInvoiceDetails } from "#src/db/json.ts";

export const getCompanyDetails = (config: EnvConfig): OrderInvoiceDetails => ({
  seller: {
    name: config.COMPANY_LEGAL_NAME ?? "Acme Inc.",
    businessId: config.COMPANY_BUSINESS_ID ?? "0000000-0",
    address: config.COMPANY_ADDRESS ?? "1 Example Street, 00000 Example City",
  },
});

export const getCompanyContactInformation = (config: EnvConfig) => ({
  email: config.COMPANY_CONTACT_EMAIL ?? "hello@example.com",
  phone: config.COMPANY_CONTACT_PHONE ?? "+1 555 0100",
});
