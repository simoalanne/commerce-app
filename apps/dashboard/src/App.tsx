import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import AdminActionLogsPage from "@/features/admin/admin-action-logs/AdminActionLogsPage";
import GrantAdminPage from "@/features/admin/admins/GrantAdminPage.tsx";
import PromotionCodesPage from "@/features/admin/promotion-codes/PromotionCodesPage";
import WebhooksPage from "@/features/admin/webhooks/WebhooksPage";
import Login from "@/features/auth/LoginPage";
import RequireAdminSession from "@/features/auth/RequireAdminSessionGuard";
import DashBoard from "@/features/operations/dashboard/Dashboard";
import Orders from "@/features/operations/orders/OrdersPage";
import Profile from "@/features/user/Profile";

import { AdminShell } from "./components/admin-shell";
import CategoriesPage from "./features/content-management/categories/CategoriesPage";
import ImagesPage from "./features/content-management/images/ImagesPage";
import LegalDocumentsPage from "./features/content-management/legal-documents/LegalDocumentsPage";
import ProductsPage from "./features/content-management/products/ProductsPage";
import VendorsPage from "./features/content-management/vendors/VendorsPage";
import { ContactSubmissionsPage } from "./features/operations/customers/ContactSubmissionsPage";
import { CustomersPage } from "./features/operations/customers/CustomersPage";
import ReviewsPage from "./features/operations/customers/ReviewsPage";

function App() {
  return (
    <Routes>
      <Route path="/login/*" element={<Login />} />
      <Route
        element={
          <RequireAdminSession>
            <AdminShell>
              <Outlet />
            </AdminShell>
          </RequireAdminSession>
        }
      >
        <Route path="/dashboard" element={<DashBoard />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/contact-submissions" element={<ContactSubmissionsPage />} />
        <Route path="/customers/reviews" element={<ReviewsPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/legal-documents" element={<LegalDocumentsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/images" element={<ImagesPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/promotion-codes" element={<PromotionCodesPage />} />
        <Route path="/webhooks" element={<WebhooksPage />} />
        <Route path="/admin-action-logs" element={<AdminActionLogsPage />} />
        <Route path="/admins" element={<GrantAdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
