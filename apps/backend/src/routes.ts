import { categoriesRoutes as customerCategoriesRoutes } from "./features/customer-api/categories/categories.routes.ts";
import { checkoutRoutes } from "./features/customer-api/checkout/checkout.routes.ts";
import { contactSubmissionsRoutes as customerContactSubmissionsRoutes } from "./features/customer-api/contactSubmissions/contactSubmissions.routes.ts";
import { legalDocumentsRoutes as customerLegalDocumentsRoutes } from "./features/customer-api/legalDocuments/legalDocuments.routes.ts";
import { orderReviewsRoutes } from "./features/customer-api/orderReviews/orderReviews.routes.ts";
import { ordersRoutes as customerOrdersRoutes } from "./features/customer-api/orders/orders.routes.ts";
import { productsRoutes as customerProductsRoutes } from "./features/customer-api/products/products.routes.ts";
import { reviewsRoutes as customerReviewsRoutes } from "./features/customer-api/reviews/reviews.routes.ts";
import { searchRoutes } from "./features/customer-api/search/search.routes.ts";
import { storefrontRoutes } from "./features/customer-api/storefront/storefront.routes.ts";
import { userRoutes } from "./features/customer-api/users/users.routes.ts";
import { vendorsRoutes as customerVendorsRoutes } from "./features/customer-api/vendors/vendors.routes.ts";
import { adminActionLogsRoutes } from "./features/dashboard-api/adminActionLogs/adminActionLogs.routes.ts";
import { adminsRoutes } from "./features/dashboard-api/admins/admins.routes.ts";
import { authRoutes } from "./features/dashboard-api/auth/auth.routes.ts";
import { categoriesRoutes as dashboardCategoriesRoutes } from "./features/dashboard-api/categories/categories.routes.ts";
import { contactSubmissionsRoutes as dashboardContactSubmissionsRoutes } from "./features/dashboard-api/contactSubmissions/contactSubmissions.routes.ts";
import { customersRoutes } from "./features/dashboard-api/customers/customers.routes.ts";
import { imagesRoutes } from "./features/dashboard-api/images/images.routes.ts";
import { legalDocumentsRoutes as dashboardLegalDocumentsRoutes } from "./features/dashboard-api/legalDocuments/legalDocuments.routes.ts";
import { ordersRoutes as dashboardOrdersRoutes } from "./features/dashboard-api/orders/orders.routes.ts";
import { productsRoutes as dashboardProductsRoutes } from "./features/dashboard-api/products/products.routes.ts";
import { promotionCodesRoutes } from "./features/dashboard-api/promotionCodes/promotionCodes.routes.ts";
import { reviewsRoutes as dashboardReviewsRoutes } from "./features/dashboard-api/reviews/reviews.routes.ts";
import { summaryRoutes } from "./features/dashboard-api/summary/summary.routes.ts";
import { tagsRoutes } from "./features/dashboard-api/tags/tags.routes.ts";
import { vendorsRoutes as dashboardVendorsRoutes } from "./features/dashboard-api/vendors/vendors.routes.ts";
import { webhooksRoutes } from "./features/dashboard-api/webhooks/webhooks.routes.ts";
import {
  customerReadyRoutes,
  dashboardReadyRoutes,
} from "./features/shared-api/ready/ready.routes.ts";

export const customerRouter = {
  categories: customerCategoriesRoutes,
  checkout: checkoutRoutes,
  contactSubmissions: customerContactSubmissionsRoutes,
  legalDocuments: customerLegalDocumentsRoutes,
  orderReviews: orderReviewsRoutes,
  orders: customerOrdersRoutes,
  vendors: customerVendorsRoutes,
  products: customerProductsRoutes,
  ready: customerReadyRoutes,
  reviews: customerReviewsRoutes,
  search: searchRoutes,
  storefront: storefrontRoutes,
  user: userRoutes,
};

export const dashboardRouter = {
  adminActionLogs: adminActionLogsRoutes,
  admins: adminsRoutes,
  auth: authRoutes,
  categories: dashboardCategoriesRoutes,
  contactSubmissions: dashboardContactSubmissionsRoutes,
  customers: customersRoutes,
  images: imagesRoutes,
  legalDocuments: dashboardLegalDocumentsRoutes,
  orders: dashboardOrdersRoutes,
  vendors: dashboardVendorsRoutes,
  products: dashboardProductsRoutes,
  promotionCodes: promotionCodesRoutes,
  ready: dashboardReadyRoutes,
  reviews: dashboardReviewsRoutes,
  summary: summaryRoutes,
  tags: tagsRoutes,
  webhooks: webhooksRoutes,
};
