import { Fragment, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Save, Loader2, ShieldCheck, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useGetModuleAccess,
  useUpdateModuleAccess,
  getGetModuleAccessQueryKey,
  getGetMyModulesQueryKey,
} from "@workspace/api-client-react";

const ROLE_LABELS: Record<string, string> = {
  sales: "Sales",
  project_manager: "Project Manager",
  finance: "Finance",
  service: "Service",
  engineer: "Engineer",
  hr: "HR",
};

function keyFor(role: string, moduleKey: string) {
  return `${role}::${moduleKey}`;
}

export default function ModuleManagementPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useGetModuleAccess({
    query: { queryKey: getGetModuleAccessQueryKey() },
  });
  const updateMut = useUpdateModuleAccess();

  // Local mutable state: Set of "role::moduleKey" strings representing granted access.
  const [granted, setGranted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!data) return;
    const set = new Set<string>();
    for (const a of data.assignments) set.add(keyFor(a.role, a.moduleKey));
    setGranted(set);
  }, [data]);

  // Group modules by their group field, preserving registry order.
  type ModuleDef = { key: string; label: string; group: string };
  const grouped = useMemo<Array<{ group: string; modules: ModuleDef[] }>>(() => {
    if (!data) return [];
    const order: string[] = [];
    const map = new Map<string, ModuleDef[]>();
    for (const m of data.modules) {
      if (!map.has(m.group)) {
        map.set(m.group, []);
        order.push(m.group);
      }
      map.get(m.group)!.push(m);
    }
    return order.map((g) => ({ group: g, modules: map.get(g)! }));
  }, [data]);

  const initialKeys = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.assignments.map((a) => keyFor(a.role, a.moduleKey)));
  }, [data]);

  const isDirty = useMemo(() => {
    if (granted.size !== initialKeys.size) return true;
    for (const k of granted) if (!initialKeys.has(k)) return true;
    return false;
  }, [granted, initialKeys]);

  const toggle = (role: string, moduleKey: string) => {
    setGranted((prev) => {
      const next = new Set(prev);
      const k = keyFor(role, moduleKey);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const setRoleAll = (role: string, value: boolean) => {
    if (!data) return;
    setGranted((prev) => {
      const next = new Set(prev);
      for (const m of data.modules) {
        const k = keyFor(role, m.key);
        if (value) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  };

  const reset = () => setGranted(new Set(initialKeys));

  const save = () => {
    if (!data) return;
    const assignments = Array.from(granted).map((k) => {
      const [role, moduleKey] = k.split("::");
      return { role, moduleKey };
    });
    updateMut.mutate(
      { data: { assignments } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetModuleAccessQueryKey() });
          qc.invalidateQueries({ queryKey: getGetMyModulesQueryKey() });
          toast({ title: "Module access saved" });
        },
        onError: (err: any) =>
          toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
      },
    );
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const roles = data.managedRoles;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <ShieldCheck className="h-6 w-6" /> Module Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which modules each role can access. Administrators always have access to every
            module. Users will see only the sidebar items and pages enabled for their role.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={reset}
            disabled={!isDirty || updateMut.isPending}
            data-testid="btn-reset"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
          </Button>
          <Button onClick={save} disabled={!isDirty || updateMut.isPending} data-testid="btn-save">
            {updateMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" /> Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role × Module access matrix</CardTitle>
          <CardDescription>
            Toggle a checkbox to grant a role access to a module. Use the row in each role header to
            select / deselect all for that role.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm" data-testid="modules-matrix">
            <thead className="bg-muted/40 border-b sticky top-0">
              <tr>
                <th className="text-left font-medium px-4 py-2 min-w-[240px]">Module</th>
                <th
                  className="text-center font-medium px-3 py-2 min-w-[110px]"
                  title="Administrators always have access to every module."
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Admin</span>
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                </th>
                {roles.map((r) => {
                  const allOn = data.modules.every((m) => granted.has(keyFor(r, m.key)));
                  return (
                    <th
                      key={r}
                      className="text-center font-medium px-3 py-2 min-w-[120px]"
                      data-testid={`col-${r}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{ROLE_LABELS[r] ?? r}</span>
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground underline hover:text-foreground"
                          onClick={() => setRoleAll(r, !allOn)}
                          data-testid={`btn-toggle-all-${r}`}
                        >
                          {allOn ? "clear" : "all"}
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ group, modules }) => (
                <Fragment key={group}>
                  <tr className="bg-muted/20">
                    <td
                      colSpan={2 + roles.length}
                      className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {group}
                    </td>
                  </tr>
                  {modules.map((m) => (
                    <tr key={m.key} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground font-mono">{m.key}</div>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <Checkbox checked disabled aria-label="Admin always has access" />
                      </td>
                      {roles.map((r) => {
                        const k = keyFor(r, m.key);
                        const checked = granted.has(k);
                        return (
                          <td key={r} className="text-center px-3 py-2.5">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggle(r, m.key)}
                              aria-label={`${ROLE_LABELS[r] ?? r} access to ${m.label}`}
                              data-testid={`cell-${r}-${m.key}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
