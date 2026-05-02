import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyModules } from "@/hooks/use-my-modules";

/**
 * Guards a page behind a module-access check. Admin always passes.
 * Shows "Access denied" for users whose role does not have the module enabled
 * in /admin/modules.
 */
export function ModuleRoute({
  module,
  children,
}: {
  module: string;
  children: ReactNode;
}) {
  const { isLoading, has } = useMyModules();
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!has(module)) {
    return (
      <Card data-testid="module-forbidden">
        <CardContent className="p-8 text-center space-y-2">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <p className="font-medium">Access denied.</p>
          <p className="text-sm text-muted-foreground">
            Your role does not have access to this module. Contact an administrator
            to grant access in Admin → Module Management.
          </p>
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}
