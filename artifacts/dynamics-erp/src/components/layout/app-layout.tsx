import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Building2, Contact2, LogOut, Sun, Moon, Search, Package, FileText, Calculator,
  CheckSquare, ShoppingCart, HardHat, Wrench, ShieldCheck, Receipt, IndianRupee, BarChart3, FileBarChart,
  Truck, ShoppingBag, FileSpreadsheet, Wallet, ChevronDown, Settings, Mail, IdCard, Plug, UserCog, Bell, Send, Inbox,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuth } from "@/hooks/use-auth";
import { useLogout, getGetCurrentUserQueryKey, useGetCompanySettings } from "@workspace/api-client-react";
import { useMyModules } from "@/hooks/use-my-modules";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type NavItem = { title: string; href: string; icon: any; module?: string };
type NavSection = { label?: string; items: NavItem[]; key?: string; adminOnly?: boolean };

const NAV: NavSection[] = [
  { items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard, module: "dashboard" }] },
  {
    label: "CRM", key: "crm",
    items: [
      { title: "Leads", href: "/leads", icon: Users, module: "crm.leads" },
      { title: "Accounts", href: "/accounts", icon: Building2, module: "crm.accounts" },
      { title: "Contacts", href: "/contacts", icon: Contact2, module: "crm.contacts" },
    ],
  },
  {
    label: "Sales", key: "sales",
    items: [
      { title: "Catalog", href: "/catalog", icon: Package, module: "sales.catalog" },
      { title: "Quotations", href: "/quotations", icon: FileText, module: "sales.quotations" },
      { title: "Estimations", href: "/estimations", icon: Calculator, module: "sales.estimations" },
      { title: "Approvals", href: "/approvals", icon: CheckSquare, module: "sales.approvals" },
      { title: "Sales Orders", href: "/sales-orders", icon: ShoppingCart, module: "sales.orders" },
    ],
  },
  {
    label: "Operations", key: "ops",
    items: [
      { title: "Projects", href: "/projects", icon: HardHat, module: "ops.projects" },
      { title: "Service Tickets", href: "/service-tickets", icon: Wrench, module: "ops.service_tickets" },
      { title: "AMC Contracts", href: "/amc-contracts", icon: ShieldCheck, module: "ops.amc_contracts" },
    ],
  },
  {
    label: "Billing", key: "billing",
    items: [
      { title: "Invoices", href: "/invoices", icon: Receipt, module: "billing.invoices" },
      { title: "Financial Dashboard", href: "/financial", icon: BarChart3, module: "billing.financial" },
      { title: "Ageing Report", href: "/financial/ageing", icon: IndianRupee, module: "billing.ageing" },
      { title: "GST Reports", href: "/financial/gst-report", icon: FileBarChart, module: "billing.gst" },
    ],
  },
  {
    label: "Procurement", key: "procurement",
    items: [
      { title: "Procurement Dashboard", href: "/procurement", icon: BarChart3, module: "proc.dashboard" },
      { title: "Vendors", href: "/vendors", icon: Truck, module: "proc.vendors" },
      { title: "Purchase Orders", href: "/purchase-orders", icon: ShoppingBag, module: "proc.purchase_orders" },
      { title: "Vendor Invoices", href: "/vendor-invoices", icon: FileSpreadsheet, module: "proc.vendor_invoices" },
      { title: "Expenses", href: "/expenses", icon: Wallet, module: "proc.expenses" },
    ],
  },
  {
    label: "Admin", key: "admin", adminOnly: true,
    items: [
      { title: "Company Settings", href: "/admin/company-settings", icon: Settings },
      { title: "Users", href: "/admin/users", icon: Users },
      { title: "Staff", href: "/admin/staff", icon: IdCard },
      { title: "Module Management", href: "/admin/modules", icon: ShieldCheck },
      { title: "Email Templates", href: "/admin/email-templates", icon: Mail },
      { title: "Email Settings", href: "/admin/email-settings", icon: Send },
      { title: "Inbox", href: "/admin/inbox", icon: Inbox },
      { title: "Integrations", href: "/admin/integrations", icon: Plug },
    ],
  },
];

const COLLAPSE_KEY = "derp.sidebar.collapsed";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const [location] = useLocation();
  const { data: company } = useGetCompanySettings();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}"); } catch { return {}; }
  });

  // IMPORTANT: call all hooks BEFORE any early returns to avoid React's
  // "Rendered more hooks than during the previous render" error.
  const isAdmin = user?.role === "admin";
  const { has: hasModule, isLoading: modulesLoading } = useMyModules();

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/login");
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync(undefined);
    } catch {
      // ignore — we still want to clear state and redirect
    } finally {
      await queryClient.cancelQueries();
      queryClient.clear();
      window.location.replace("/login");
    }
  };

  // Filter NAV by:
  //   - admin-only sections only visible to admins
  //   - non-admin sections: hide individual items the user lacks module access for,
  //     and hide entire sections that end up empty
  // While the module list is still loading we keep showing all items the user is
  // not strictly forbidden from (simpler than flickering).
  const sections = NAV
    .filter((s) => !s.adminOnly || isAdmin)
    .map((s) => {
      if (s.adminOnly) return s;
      const items = s.items.filter((i) => !i.module || isAdmin || modulesLoading || hasModule(i.module));
      return { ...s, items };
    })
    .filter((s) => s.items.length > 0);
  const brandName = company?.name ?? "DynamicsERP";
  const brandLogoSrc = (() => {
    const u = company?.logoUrl;
    if (!u) return null;
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/objects/")) return `/api/storage${u}`;
    return u;
  })();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border bg-sidebar" data-testid="sidebar">
          <SidebarHeader className="p-4 border-b border-border">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              {brandLogoSrc ? (
                <img
                  src={brandLogoSrc}
                  alt={brandName}
                  className="h-6 w-6 shrink-0 object-contain"
                  data-testid="sidebar-brand-logo"
                />
              ) : (
                <Sun className="h-6 w-6 shrink-0" />
              )}
              <span className="truncate">{brandName}</span>
            </h2>
          </SidebarHeader>
          <SidebarContent>
            {sections.map((section, idx) => {
              if (!section.label || !section.key) {
                return (
                  <div key={idx} className="px-2 pt-3">
                    <SidebarMenu className="gap-1">
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={location === item.href}>
                            <Link href={item.href} data-testid={`nav-item-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                              <item.icon className="w-5 h-5 mr-2" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </div>
                );
              }
              const isOpen = !collapsed[section.key];
              return (
                <Collapsible key={section.key} open={isOpen} onOpenChange={(open) => setCollapsed(c => ({ ...c, [section.key!]: !open }))} className="px-2 pt-3">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between px-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors" data-testid={`group-toggle-${section.key}`}>
                      <span>{section.label}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu className="gap-1">
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={location === item.href}>
                            <Link href={item.href} data-testid={`nav-item-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                              <item.icon className="w-5 h-5 mr-2" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </SidebarContent>
          <SidebarFooter className="border-t border-border p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="user-menu-button"
                >
                  <Avatar className="h-9 w-9 shrink-0 border border-border">
                    <AvatarImage src={user?.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium leading-tight">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground leading-tight">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-60">
                <div className="flex items-center gap-3 px-2 py-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium leading-tight">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground leading-tight">
                      {user?.email}
                    </span>
                    <span className="mt-1 inline-flex w-fit rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {user?.role?.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <Separator className="my-1" />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setLocation("/notifications")}
                  data-testid="menu-notifications"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setLocation("/admin/users")}
                    data-testid="menu-admin"
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    User management
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  data-testid="menu-theme"
                >
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  Switch to {theme === "dark" ? "light" : "dark"} mode
                </DropdownMenuItem>
                <Separator className="my-1" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                  data-testid="menu-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card sticky top-0 z-10 print:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="relative w-64 hidden sm:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search..." className="pl-8 bg-muted border-none" data-testid="input-global-search" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} data-testid="btn-theme-toggle">
                <Sun className="h-5 w-5 dark:hidden" />
                <Moon className="h-5 w-5 hidden dark:block" />
                <span className="sr-only">Toggle theme</span>
              </Button>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
