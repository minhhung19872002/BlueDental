import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

// ── Types ────────────────────────────────────────────────────────────────

export interface PermissionTreeNode {
  type: "group" | "leaf";
  id: string;
  label: string;
  children?: PermissionTreeNode[];
}

interface AbpPermissionGroup {
  name: string;
  displayName: string;
  permissions: AbpPermissionItem[];
}

interface AbpPermissionItem {
  name: string;
  displayName: string;
  isGranted: boolean;
  parentName: string | null;
  allowedProviders: string[];
}

export interface RolePermissionsResult {
  groups: AbpPermissionGroup[];
  grantedIds: Set<string>;
}

// ── API calls ────────────────────────────────────────────────────────────

const rolePermissionApi = {
  getPermissionTree: (): Promise<PermissionTreeNode[]> =>
    api.get("/v1/app/role-permission/permission-tree").then((r) => r.data.tree),

  getRolePermissions: async (roleName: string): Promise<RolePermissionsResult> => {
    const res = await api.get("/permission-management/permissions", {
      params: { providerName: "R", providerKey: roleName },
    });
    const groups: AbpPermissionGroup[] = res.data.groups ?? [];
    const grantedIds = new Set<string>();
    for (const group of groups) {
      for (const perm of group.permissions) {
        if (perm.isGranted) {
          const abilityId = extractAbilityId(perm.name);
          if (abilityId) grantedIds.add(abilityId);
        }
      }
    }
    return { groups, grantedIds };
  },

  updateRolePermissions: (
    roleName: string,
    permissions: { name: string; isGranted: boolean }[]
  ): Promise<void> =>
    api.put("/permission-management/permissions", { permissions }, {
      params: { providerName: "R", providerKey: roleName },
    }),
};

function extractAbilityId(abpPermName: string): string | null {
  if (!abpPermName.startsWith("BlueDental.")) return null;
  const rest = abpPermName.substring("BlueDental.".length);
  const dotIndex = rest.indexOf(".");
  if (dotIndex === -1) return null;
  return rest;
}

// ── Hooks ────────────────────────────────────────────────────────────────

export const rolePermissionKeys = {
  tree: ["role-permission-tree"] as const,
  rolePerms: (roleName: string) => ["role-permissions", roleName] as const,
};

export function usePermissionTree() {
  return useQuery({
    queryKey: rolePermissionKeys.tree,
    queryFn: rolePermissionApi.getPermissionTree,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRolePermissions(roleName: string | null) {
  return useQuery({
    queryKey: rolePermissionKeys.rolePerms(roleName ?? ""),
    queryFn: () => rolePermissionApi.getRolePermissions(roleName!),
    enabled: !!roleName,
  });
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleName, permissions }: {
      roleName: string;
      permissions: { name: string; isGranted: boolean }[];
    }) => rolePermissionApi.updateRolePermissions(roleName, permissions),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: rolePermissionKeys.rolePerms(variables.roleName) });
    },
  });
}
