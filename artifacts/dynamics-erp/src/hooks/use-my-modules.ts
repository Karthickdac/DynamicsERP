import { useGetMyModules, getGetMyModulesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Returns the set of module keys the current user can access.
 * Admins always get every module key (the API returns all of them too,
 * but we additionally treat admin role as a fast-path "always true").
 */
export function useMyModules() {
  const { isAuthenticated, user } = useAuth();
  const query = useGetMyModules({
    query: {
      enabled: isAuthenticated,
      queryKey: getGetMyModulesQueryKey(),
      staleTime: 60_000,
    },
  });

  const isAdmin = user?.role === "admin";
  const moduleKeys = new Set<string>(query.data?.moduleKeys ?? []);

  const has = (key: string | undefined): boolean => {
    if (!key) return true;
    if (isAdmin) return true;
    return moduleKeys.has(key);
  };

  return {
    isLoading: query.isLoading,
    moduleKeys,
    has,
    isAdmin,
  };
}
