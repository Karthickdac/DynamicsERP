import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Dashboard from "@/pages/dashboard";
import Accounts from "@/pages/accounts";
import AccountDetail from "@/pages/accounts/detail";
import Contacts from "@/pages/contacts";
import ContactDetail from "@/pages/contacts/detail";
import Leads from "@/pages/leads";
import LeadDetail from "@/pages/leads/detail";
import Catalog from "@/pages/catalog";
import Quotations from "@/pages/quotations";
import QuotationDetail from "@/pages/quotations/detail";
import QuotationPrint from "@/pages/quotations/print";
import Estimations from "@/pages/estimations";
import Approvals from "@/pages/approvals";
import ApprovalRules from "@/pages/approvals/rules";
import SalesOrders from "@/pages/sales-orders";
import SalesOrderDetail from "@/pages/sales-orders/detail";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/projects/detail";
import ServiceTickets from "@/pages/service-tickets";
import ServiceTicketDetail from "@/pages/service-tickets/detail";
import AmcContracts from "@/pages/amc-contracts";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoices/detail";
import FinancialDashboard from "@/pages/financial/dashboard";
import AgeingReport from "@/pages/financial/ageing";
import GstReport from "@/pages/financial/gst-report";
import Vendors from "@/pages/vendors";
import VendorDetail from "@/pages/vendors/detail";
import PurchaseOrders from "@/pages/purchase-orders";
import PurchaseOrderDetail from "@/pages/purchase-orders/detail";
import VendorInvoices from "@/pages/vendor-invoices";
import Expenses from "@/pages/expenses";
import ProcurementDashboard from "@/pages/procurement/dashboard";
import NotificationsPage from "@/pages/notifications";
import NotificationPreferencesPage from "@/pages/notifications/preferences";
import CompanySettingsPage from "@/pages/admin/company-settings";
import UsersAdminPage from "@/pages/admin/users";
import StaffPage from "@/pages/admin/staff";
import EmailTemplatesPage from "@/pages/admin/email-templates";
import IntegrationsPage from "@/pages/admin/integrations";
import { AdminRoute } from "@/components/admin-route";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/quotations/:id/print" component={QuotationPrint} />
      <Route path="/">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/accounts">
        <AppLayout><Accounts /></AppLayout>
      </Route>
      <Route path="/accounts/:id">
        <AppLayout><AccountDetail /></AppLayout>
      </Route>
      <Route path="/contacts">
        <AppLayout><Contacts /></AppLayout>
      </Route>
      <Route path="/contacts/:id">
        <AppLayout><ContactDetail /></AppLayout>
      </Route>
      <Route path="/leads">
        <AppLayout><Leads /></AppLayout>
      </Route>
      <Route path="/leads/:id">
        <AppLayout><LeadDetail /></AppLayout>
      </Route>
      <Route path="/catalog">
        <AppLayout><Catalog /></AppLayout>
      </Route>
      <Route path="/quotations">
        <AppLayout><Quotations /></AppLayout>
      </Route>
      <Route path="/quotations/:id">
        <AppLayout><QuotationDetail /></AppLayout>
      </Route>
      <Route path="/estimations">
        <AppLayout><Estimations /></AppLayout>
      </Route>
      <Route path="/approvals">
        <AppLayout><Approvals /></AppLayout>
      </Route>
      <Route path="/approvals/rules">
        <AppLayout><ApprovalRules /></AppLayout>
      </Route>
      <Route path="/sales-orders">
        <AppLayout><SalesOrders /></AppLayout>
      </Route>
      <Route path="/sales-orders/:id">
        <AppLayout><SalesOrderDetail /></AppLayout>
      </Route>
      <Route path="/projects">
        <AppLayout><Projects /></AppLayout>
      </Route>
      <Route path="/projects/:id">
        <AppLayout><ProjectDetail /></AppLayout>
      </Route>
      <Route path="/service-tickets">
        <AppLayout><ServiceTickets /></AppLayout>
      </Route>
      <Route path="/service-tickets/:id">
        <AppLayout><ServiceTicketDetail /></AppLayout>
      </Route>
      <Route path="/amc-contracts">
        <AppLayout><AmcContracts /></AppLayout>
      </Route>
      <Route path="/invoices">
        <AppLayout><Invoices /></AppLayout>
      </Route>
      <Route path="/invoices/:id">
        <AppLayout><InvoiceDetail /></AppLayout>
      </Route>
      <Route path="/financial">
        <AppLayout><FinancialDashboard /></AppLayout>
      </Route>
      <Route path="/financial/ageing">
        <AppLayout><AgeingReport /></AppLayout>
      </Route>
      <Route path="/financial/gst-report">
        <AppLayout><GstReport /></AppLayout>
      </Route>
      <Route path="/vendors">
        <AppLayout><Vendors /></AppLayout>
      </Route>
      <Route path="/vendors/:id">
        <AppLayout><VendorDetail /></AppLayout>
      </Route>
      <Route path="/purchase-orders">
        <AppLayout><PurchaseOrders /></AppLayout>
      </Route>
      <Route path="/purchase-orders/:id">
        <AppLayout><PurchaseOrderDetail /></AppLayout>
      </Route>
      <Route path="/vendor-invoices">
        <AppLayout><VendorInvoices /></AppLayout>
      </Route>
      <Route path="/expenses">
        <AppLayout><Expenses /></AppLayout>
      </Route>
      <Route path="/procurement">
        <AppLayout><ProcurementDashboard /></AppLayout>
      </Route>
      <Route path="/notifications">
        <AppLayout><NotificationsPage /></AppLayout>
      </Route>
      <Route path="/notifications/preferences">
        <AppLayout><NotificationPreferencesPage /></AppLayout>
      </Route>
      <Route path="/admin/company-settings">
        <AppLayout><AdminRoute><CompanySettingsPage /></AdminRoute></AppLayout>
      </Route>
      <Route path="/admin/users">
        <AppLayout><AdminRoute><UsersAdminPage /></AdminRoute></AppLayout>
      </Route>
      <Route path="/admin/staff">
        <AppLayout><AdminRoute allowedRoles={["admin", "hr"]}><StaffPage /></AdminRoute></AppLayout>
      </Route>
      <Route path="/admin/email-templates">
        <AppLayout><AdminRoute><EmailTemplatesPage /></AdminRoute></AppLayout>
      </Route>
      <Route path="/admin/integrations">
        <AppLayout><AdminRoute><IntegrationsPage /></AdminRoute></AppLayout>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
