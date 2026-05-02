import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminRoute({ children, allowedRoles = ["admin"] }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;
  if (!isAuthenticated || !user) {
    return (
      <Card><CardContent className="p-8 text-center space-y-2">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="font-medium">You must sign in to view this page.</p>
      </CardContent></Card>
    );
  }
  if (!allowedRoles.includes(user.role)) {
    return (
      <Card data-testid="admin-forbidden"><CardContent className="p-8 text-center space-y-2">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <p className="font-medium">Access denied.</p>
        <p className="text-sm text-muted-foreground">This page is restricted to administrators.</p>
      </CardContent></Card>
    );
  }
  return <>{children}</>;
}
