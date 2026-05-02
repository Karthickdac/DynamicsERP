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
import EmailSettingsPage from "@/pages/admin/email-settings";
import InboxPage from "@/pages/admin/inbox";
import IntegrationsPage from "@/pages/admin/integrations";
import ModuleManagementPage from "@/pages/admin/modules";
import { AdminRoute } from "@/components/admin-route";
import { ModuleRoute } from "@/components/module-route";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/quotations/:id/print" component={QuotationPrint} />
      <Route path="/">
        <AppLayout><ModuleRoute module="dashboard"><Dashboard /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/accounts">
        <AppLayout><ModuleRoute module="crm.accounts"><Accounts /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/accounts/:id">
        <AppLayout><ModuleRoute module="crm.accounts"><AccountDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/contacts">
        <AppLayout><ModuleRoute module="crm.contacts"><Contacts /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/contacts/:id">
        <AppLayout><ModuleRoute module="crm.contacts"><ContactDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/leads">
        <AppLayout><ModuleRoute module="crm.leads"><Leads /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/leads/:id">
        <AppLayout><ModuleRoute module="crm.leads"><LeadDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/catalog">
        <AppLayout><ModuleRoute module="sales.catalog"><Catalog /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/quotations">
        <AppLayout><ModuleRoute module="sales.quotations"><Quotations /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/quotations/:id">
        <AppLayout><ModuleRoute module="sales.quotations"><QuotationDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/estimations">
        <AppLayout><ModuleRoute module="sales.estimations"><Estimations /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/approvals">
        <AppLayout><ModuleRoute module="sales.approvals"><Approvals /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/approvals/rules">
        <AppLayout><ModuleRoute module="sales.approvals"><ApprovalRules /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/sales-orders">
        <AppLayout><ModuleRoute module="sales.orders"><SalesOrders /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/sales-orders/:id">
        <AppLayout><ModuleRoute module="sales.orders"><SalesOrderDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/projects">
        <AppLayout><ModuleRoute module="ops.projects"><Projects /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/projects/:id">
        <AppLayout><ModuleRoute module="ops.projects"><ProjectDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/service-tickets">
        <AppLayout><ModuleRoute module="ops.service_tickets"><ServiceTickets /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/service-tickets/:id">
        <AppLayout><ModuleRoute module="ops.service_tickets"><ServiceTicketDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/amc-contracts">
        <AppLayout><ModuleRoute module="ops.amc_contracts"><AmcContracts /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/invoices">
        <AppLayout><ModuleRoute module="billing.invoices"><Invoices /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/invoices/:id">
        <AppLayout><ModuleRoute module="billing.invoices"><InvoiceDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/financial">
        <AppLayout><ModuleRoute module="billing.financial"><FinancialDashboard /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/financial/ageing">
        <AppLayout><ModuleRoute module="billing.ageing"><AgeingReport /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/financial/gst-report">
        <AppLayout><ModuleRoute module="billing.gst"><GstReport /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/vendors">
        <AppLayout><ModuleRoute module="proc.vendors"><Vendors /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/vendors/:id">
        <AppLayout><ModuleRoute module="proc.vendors"><VendorDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/purchase-orders">
        <AppLayout><ModuleRoute module="proc.purchase_orders"><PurchaseOrders /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/purchase-orders/:id">
        <AppLayout><ModuleRoute module="proc.purchase_orders"><PurchaseOrderDetail /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/vendor-invoices">
        <AppLayout><ModuleRoute module="proc.vendor_invoices"><VendorInvoices /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/expenses">
        <AppLayout><ModuleRoute module="proc.expenses"><Expenses /></ModuleRoute></AppLayout>
      </Route>
      <Route path="/procurement">
        <AppLayout><ModuleRoute module="proc.dashboard"><ProcurementDashboard /></ModuleRoute></AppLayout>
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
      <Route path="/admin/email-settings">
        <AppLayout><AdminRoute><EmailSettingsPage /></AdminRoute></AppLayout>
      </Route>
      <Route path="/admin/inbox">
        <AppLayout><AdminRoute><InboxPage /></AdminRoute></AppLayout>
      </Route>
      <Route path="/admin/integrations">
        <AppLayout><AdminRoute><IntegrationsPage /></AdminRoute></AppLayout>
      </Route>
      <Route path="/admin/modules">
        <AppLayout><AdminRoute><ModuleManagementPage /></AdminRoute></AppLayout>
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
