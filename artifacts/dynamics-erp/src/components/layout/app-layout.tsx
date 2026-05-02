import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Building2, Contact2, LogOut, Sun, Moon, Search, Package, FileText, Calculator, CheckSquare, ShoppingCart, HardHat, Wrench, ShieldCheck, Receipt, IndianRupee, BarChart3, FileBarChart, Truck, ShoppingBag, FileSpreadsheet, Wallet } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuth } from "@/hooks/use-auth";
import { useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const [location] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/login");
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setLocation("/login");
      },
    });
  };

  const navSections: { label?: string; items: { title: string; href: string; icon: any }[] }[] = [
    {
      items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
    },
    {
      label: "CRM",
      items: [
        { title: "Leads", href: "/leads", icon: Users },
        { title: "Accounts", href: "/accounts", icon: Building2 },
        { title: "Contacts", href: "/contacts", icon: Contact2 },
      ],
    },
    {
      label: "Sales",
      items: [
        { title: "Catalog", href: "/catalog", icon: Package },
        { title: "Quotations", href: "/quotations", icon: FileText },
        { title: "Estimations", href: "/estimations", icon: Calculator },
        { title: "Approvals", href: "/approvals", icon: CheckSquare },
        { title: "Sales Orders", href: "/sales-orders", icon: ShoppingCart },
      ],
    },
    {
      label: "Operations",
      items: [
        { title: "Projects", href: "/projects", icon: HardHat },
        { title: "Service Tickets", href: "/service-tickets", icon: Wrench },
        { title: "AMC Contracts", href: "/amc-contracts", icon: ShieldCheck },
      ],
    },
    {
      label: "Billing",
      items: [
        { title: "Invoices", href: "/invoices", icon: Receipt },
        { title: "Financial Dashboard", href: "/financial", icon: BarChart3 },
        { title: "Ageing Report", href: "/financial/ageing", icon: IndianRupee },
        { title: "GST Reports", href: "/financial/gst-report", icon: FileBarChart },
      ],
    },
    {
      label: "Procurement",
      items: [
        { title: "Procurement Dashboard", href: "/procurement", icon: BarChart3 },
        { title: "Vendors", href: "/vendors", icon: Truck },
        { title: "Purchase Orders", href: "/purchase-orders", icon: ShoppingBag },
        { title: "Vendor Invoices", href: "/vendor-invoices", icon: FileSpreadsheet },
        { title: "Expenses", href: "/expenses", icon: Wallet },
      ],
    },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border bg-sidebar" data-testid="sidebar">
          <SidebarHeader className="p-4 border-b border-border">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <Sun className="h-6 w-6" />
              DynamicsERP
            </h2>
          </SidebarHeader>
          <SidebarContent>
            {navSections.map((section, idx) => (
              <div key={idx} className="px-2 pt-3">
                {section.label && (
                  <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{section.label}</div>
                )}
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
            ))}
          </SidebarContent>
          <SidebarFooter className="border-t border-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-2 py-6 h-auto" data-testid="user-menu-button">
                  <div className="flex items-center gap-3 w-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.avatarUrl ?? undefined} />
                      <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start flex-1 overflow-hidden">
                      <span className="text-sm font-medium truncate w-full">{user?.firstName} {user?.lastName}</span>
                      <span className="text-xs text-muted-foreground uppercase">{user?.role?.replace("_", " ")}</span>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer" data-testid="menu-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card sticky top-0 z-10">
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
