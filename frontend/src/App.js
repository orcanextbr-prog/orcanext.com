import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Onboarding from "@/pages/Onboarding";
import DashboardLayout from "@/pages/DashboardLayout";
import QuotesList from "@/pages/dashboard/QuotesList";
import Overview from "@/pages/dashboard/Overview";
import QuoteEditor from "@/pages/dashboard/QuoteEditor";
import Clients from "@/pages/dashboard/Clients";
import Products from "@/pages/dashboard/Products";
import Services from "@/pages/dashboard/Services";
import Receipts from "@/pages/dashboard/Receipts";
import MyCompany from "@/pages/dashboard/MyCompany";
import MyPlan from "@/pages/dashboard/MyPlan";
import PublicQuote from "@/pages/PublicQuote";
import Admin from "@/pages/Admin";
import BillingSuccess from "@/pages/BillingSuccess";
import BillingCancel from "@/pages/BillingCancel";

function Protected({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-zinc-500">Carregando…</div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin" && user.role !== "super_admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function CompanyGuard({ children }) {
  const { user, company, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!company) return <Navigate to="/onboarding" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/q/:token" element={<PublicQuote />} />
          <Route path="/billing/success" element={<Protected><BillingSuccess /></Protected>} />
          <Route path="/billing/cancel" element={<Protected><BillingCancel /></Protected>} />

          <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />

          <Route path="/dashboard" element={<Protected><CompanyGuard><DashboardLayout /></CompanyGuard></Protected>}>
            <Route index element={<Overview />} />
            <Route path="overview" element={<Overview />} />
            <Route path="quotes" element={<QuotesList />} />
            <Route path="quotes/new" element={<QuoteEditor />} />
            <Route path="quotes/:id" element={<QuoteEditor />} />
            <Route path="clients" element={<Clients />} />
            <Route path="products" element={<Products />} />
            <Route path="services" element={<Services />} />
            <Route path="receipts" element={<Receipts />} />
            <Route path="company" element={<MyCompany />} />
            <Route path="plan" element={<MyPlan />} />
          </Route>

          <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
