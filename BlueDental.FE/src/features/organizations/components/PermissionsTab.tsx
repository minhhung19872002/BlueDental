import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Empty, Form, Input, Modal, Spin } from "antd";
import {
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  ChevronsLeftRight,
  ChevronsRightLeft,
  Folder,
  FileText,
  Lock,
  Shield,
  ListTree,
  Trash2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { FloatingField } from "@/components/FloatingField";
import {
  usePermissionTree,
  useRolePermissions,
  useUpdateRolePermissions,
  type PermissionTreeNode,
} from "../api/rolePermissionApi";
import {
  useIdentityRoleList,
  useCreateIdentityRole,
  useDeleteIdentityRole,
} from "@/features/identity/api";

// ── helpers ──────────────────────────────────────────────────────────────

function collectLeafIds(node: PermissionTreeNode): string[] {
  if (node.type === "leaf") return [node.id];
  return (node.children ?? []).flatMap(collectLeafIds);
}

function countGranted(nodes: PermissionTreeNode[], granted: Set<string>): { total: number; checked: number } {
  let total = 0;
  let checked = 0;
  for (const n of nodes) {
    if (n.type === "leaf") {
      total++;
      if (granted.has(n.id)) checked++;
    } else if (n.children) {
      const sub = countGranted(n.children, granted);
      total += sub.total;
      checked += sub.checked;
    }
  }
  return { total, checked };
}

function matchesSearch(node: PermissionTreeNode, q: string): boolean {
  if (node.label.toLowerCase().includes(q)) return true;
  if (node.id.toLowerCase().includes(q)) return true;
  return (node.children ?? []).some((c) => matchesSearch(c, q));
}

// ── PermissionGroupNode ──────────────────────────────────────────────────

interface GroupNodeProps {
  node: PermissionTreeNode;
  granted: Set<string>;
  onToggleLeaf: (id: string) => void;
  onToggleGroup: (leafIds: string[], checked: boolean) => void;
  depth: number;
  searchQuery: string;
  defaultExpanded: boolean;
  readonly?: boolean;
}

function PermissionGroupNode({ node, granted, onToggleLeaf, onToggleGroup, depth, searchQuery, defaultExpanded, readonly: isReadonly }: GroupNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (node.type === "leaf") {
    return (
      <label className="perm-leaf">
        <Checkbox
          checked={granted.has(node.id)}
          disabled={isReadonly}
          onChange={() => onToggleLeaf(node.id)}
        />
        <FileText className="perm-leaf-icon" size={14} />
        <span className="perm-leaf-label">{node.label}</span>
      </label>
    );
  }

  const leafIds = collectLeafIds(node);
  const { total, checked } = countGranted(node.children ?? [], granted);
  const allChecked = total > 0 && checked === total;
  const indeterminate = checked > 0 && checked < total;
  const isOpen = expanded || searchQuery.length > 0;
  const isSubGroup = depth > 0 && node.type === "group" && (node.children ?? []).some((c) => c.type === "leaf");

  return (
    <div className={["perm-group", depth === 0 && "perm-group--top", isSubGroup && "perm-group--sub"].filter(Boolean).join(" ")} data-depth={depth}>
      <div
        className="perm-group-header"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
      >
        <span className="perm-group-chevron" data-open={isOpen}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M3 1.5l3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <Checkbox
          checked={allChecked}
          indeterminate={indeterminate}
          disabled={isReadonly}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleGroup(leafIds, !allChecked)}
        />
        {isSubGroup ? (
          <ListTree className="perm-group-icon" size={16} />
        ) : (
          <Folder className="perm-group-icon" size={16} />
        )}
        <span className="perm-group-label">{node.label}</span>
        {isSubGroup && <span className="perm-group-type-badge">{t("Mục")}</span>}
        <span className="perm-group-count">{checked}/{total}</span>
      </div>
      {isOpen && node.children && (
        <div className="perm-group-children">
          {node.children
            .filter((c) => searchQuery.length === 0 || matchesSearch(c, searchQuery))
            .map((child) => (
              <PermissionGroupNode
                key={child.id}
                node={child}
                granted={granted}
                onToggleLeaf={onToggleLeaf}
                onToggleGroup={onToggleGroup}
                depth={depth + 1}
                searchQuery={searchQuery}
                defaultExpanded={defaultExpanded}
                readonly={isReadonly}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ── RolePermissionEditor ─────────────────────────────────────────────────

function RolePermissionEditor({
  roleName,
  readonly: isReadonly,
}: {
  roleName: string;
  readonly?: boolean;
}) {
  const { data: treeData, isLoading: treeLoading } = usePermissionTree();
  const { data: rolePerms, isLoading: permsLoading } = useRolePermissions(roleName);
  const updatePerms = useUpdateRolePermissions();

  const [localGranted, setLocalGranted] = useState<Set<string> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allExpanded, setAllExpanded] = useState(false);

  const granted = localGranted ?? rolePerms?.grantedIds ?? new Set<string>();

  const initLocal = useCallback(() => {
    if (rolePerms && !localGranted) {
      setLocalGranted(new Set(rolePerms.grantedIds));
    }
  }, [rolePerms, localGranted]);

  const handleToggleLeaf = useCallback((id: string) => {
    initLocal();
    setLocalGranted((prev) => {
      const next = new Set(prev ?? rolePerms?.grantedIds ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [initLocal, rolePerms]);

  const handleToggleGroup = useCallback((leafIds: string[], checked: boolean) => {
    initLocal();
    setLocalGranted((prev) => {
      const next = new Set(prev ?? rolePerms?.grantedIds ?? []);
      for (const id of leafIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, [initLocal, rolePerms]);

  const allLeafIds = useMemo(() =>
    treeData ? treeData.flatMap(collectLeafIds) : [],
    [treeData]
  );

  const totalPerms = allLeafIds.length;
  const checkedCount = allLeafIds.filter((id) => granted.has(id)).length;

  const handleSave = useCallback(async () => {
    if (!localGranted) return;
    const permissions = allLeafIds.map((id) => ({
      name: `BlueDental.${id}`,
      isGranted: localGranted.has(id),
    }));
    try {
      await updatePerms.mutateAsync({ roleName, permissions });
      toast.success(t("Lưu quyền thành công"));
      setLocalGranted(null);
    } catch {
      // error handled globally
    }
  }, [localGranted, allLeafIds, roleName, updatePerms]);

  const isLoading = treeLoading || permsLoading;
  const lowerQuery = searchQuery.toLowerCase();
  const hasChanges = localGranted !== null;

  const expandKey = allExpanded ? "expanded" : "collapsed";

  if (isLoading) {
    return (
      <div className="perm-editor">
        <Spin style={{ display: "block", textAlign: "center", padding: 60 }} />
      </div>
    );
  }

  return (
    <div className="perm-editor">
      <div className="perm-editor-header">
        <div className="perm-editor-header-left">
          <div className="perm-editor-title">
            {roleName}
            {isReadonly && <Lock size={14} className="perm-editor-lock" />}
          </div>
          <div className="perm-editor-subtitle">
            {checkedCount}/{totalPerms} {t("quyền chi tiết")}
            {isReadonly && <span className="perm-editor-readonly-hint"> — {t("Vai trò hệ thống, không thể chỉnh sửa")}</span>}
          </div>
        </div>
        <div className="perm-editor-actions">
          <button
            className="bd-icon-btn"
            title={t("Mở tất cả")}
            onClick={() => setAllExpanded(true)}
          >
            <ChevronsLeftRight size={16} />
          </button>
          <button
            className="bd-icon-btn"
            title={t("Thu gọn tất cả")}
            onClick={() => setAllExpanded(false)}
          >
            <ChevronsRightLeft size={16} />
          </button>
          {!isReadonly && (
            <Button
              type="primary"
              icon={<Save size={14} />}
              loading={updatePerms.isPending}
              disabled={!hasChanges || updatePerms.isPending}
              onClick={() => void handleSave()}
            >
              {t("Lưu thay đổi")}
            </Button>
          )}
        </div>
      </div>

      <div className="perm-search-wrap">
        <Input
          prefix={<SearchOutlined />}
          placeholder={t("Tìm quyền...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </div>

      <div className="perm-tree-scroll" key={expandKey}>
        <div className="perm-tree-grid">
          {(treeData ?? [])
            .filter((node) => lowerQuery.length === 0 || matchesSearch(node, lowerQuery))
            .map((node) => (
              <PermissionGroupNode
                key={node.id}
                node={node}
                granted={granted}
                onToggleLeaf={handleToggleLeaf}
                onToggleGroup={handleToggleGroup}
                depth={0}
                searchQuery={lowerQuery}
                defaultExpanded={allExpanded}
                readonly={isReadonly}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

// ── RoleListItem ─────────────────────────────────────────────────────────

function RoleListItem({ roleName, isActive, isStatic, treeLeafIds, onClick, onDelete }: {
  roleName: string;
  isActive: boolean;
  isStatic: boolean;
  treeLeafIds: string[];
  onClick: () => void;
  onDelete: () => void;
}) {
  const { data: rolePerms } = useRolePermissions(isActive ? roleName : null);

  const grantedCount = useMemo(() => {
    if (!rolePerms || !treeLeafIds || treeLeafIds.length === 0) return null;
    let count = 0;
    for (const id of treeLeafIds) {
      if (rolePerms.grantedIds.has(id)) count++;
    }
    return count;
  }, [rolePerms, treeLeafIds]);

  return (
    <div
      className={["perm-role-item", isActive && "perm-role-item--active"]
        .filter(Boolean).join(" ")}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <span className="perm-role-shield">
        {isStatic ? <Lock size={16} /> : <Shield size={16} />}
      </span>
      <span className="perm-role-name">{roleName}</span>
      {isActive && grantedCount !== null && (
        <span className="perm-role-perm-badge">{grantedCount}</span>
      )}
      {!isStatic && (
        <button
          className="perm-role-delete-btn"
          title={t("Xóa vai trò")}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ── PermissionsTab ───────────────────────────────────────────────────────

export function PermissionsTab() {
  const qc = useQueryClient();
  const { data: roleData, isLoading: rolesLoading } = useIdentityRoleList();
  const { data: treeData } = usePermissionTree();
  const createRole = useCreateIdentityRole();
  const deleteRole = useDeleteIdentityRole();

  const treeLeafIds = useMemo(() =>
    treeData ? treeData.flatMap(collectLeafIds) : [],
    [treeData]
  );

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [addRoleForm] = Form.useForm<{ roleName: string }>();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleAddRole = async () => {
    try {
      const values = await addRoleForm.validateFields();
      const name = values.roleName.trim();
      if (!name) return;
      await createRole.mutateAsync({ name });
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t("Thêm vai trò thành công"));
      addRoleForm.resetFields();
      setAddRoleOpen(false);
    } catch {
      // validation or API error
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteRole.mutateAsync(deleteConfirm.id);
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t("Xóa vai trò thành công"));
      if (selectedRole === deleteConfirm.name) setSelectedRole(null);
      setDeleteConfirm(null);
    } catch {
      // error handled globally
    }
  };

  if (rolesLoading) {
    return <Spin style={{ display: "block", textAlign: "center", padding: 40 }} />;
  }

  const roles = [...(roleData?.items ?? [])].sort((a, b) => {
    if (a.isStatic !== b.isStatic) return a.isStatic ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="perm-layout">
      {/* Left: Role list */}
      <div className="perm-role-list">
        <div className="perm-role-list-header">
          <div className="perm-role-list-title">
            <span className="perm-role-list-title-left">
              <Shield size={16} />
              <span>{t("Vai trò")}</span>
            </span>
            <span className="perm-role-count-badge">{roles.length}</span>
          </div>
        </div>

        <div className="perm-add-role-wrap">
          <Button
            className="perm-add-role-btn"
            icon={<PlusOutlined />}
            block
            onClick={() => setAddRoleOpen(true)}
          >
            {t("Thêm vai trò")}
          </Button>
        </div>

        <div className="perm-role-items">
          {roles.map((role) => (
            <RoleListItem
              key={role.id}
              roleName={role.name}
              isActive={selectedRole === role.name}
              isStatic={role.isStatic}
              treeLeafIds={treeLeafIds}
              onClick={() => setSelectedRole(role.name)}
              onDelete={() => setDeleteConfirm({ id: role.id, name: role.name })}
            />
          ))}
        </div>
      </div>

      {/* Right: Permission tree or empty */}
      <div className="perm-right-panel">
        {selectedRole ? (
          <RolePermissionEditor
            key={selectedRole}
            roleName={selectedRole}
            readonly={roles.find((r) => r.name === selectedRole)?.isStatic}
          />
        ) : (
          <div className="perm-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Chọn một vai trò để xem và chỉnh sửa quyền hạn")}
            />
          </div>
        )}
      </div>

      {/* Add role modal */}
      <Modal
        open={addRoleOpen}
        title={t("Thêm vai trò")}
        okText={t("Thêm")}
        cancelText={t("Hủy")}
        confirmLoading={createRole.isPending}
        onOk={() => void handleAddRole()}
        onCancel={() => { setAddRoleOpen(false); addRoleForm.resetFields(); }}
        destroyOnClose
      >
        <Form form={addRoleForm} layout="vertical">
          <FloatingField
            label={t("Tên vai trò")}
            name="roleName"
            required
            rules={[{ required: true, message: t("Vui lòng nhập tên vai trò") }]}
          >
            <Input onPressEnter={() => void handleAddRole()} autoFocus />
          </FloatingField>
        </Form>
      </Modal>

      {/* Delete role confirm */}
      <Modal
        open={deleteConfirm !== null}
        title={t("Xóa vai trò")}
        okText={t("Xóa")}
        cancelText={t("Hủy")}
        okButtonProps={{ danger: true }}
        confirmLoading={deleteRole.isPending}
        onOk={() => void handleDeleteRole()}
        onCancel={() => setDeleteConfirm(null)}
      >
        {deleteConfirm && (
          <p>{t("Bạn có chắc chắn muốn xóa vai trò")} <strong>{deleteConfirm.name}</strong>?</p>
        )}
      </Modal>
    </div>
  );
}
