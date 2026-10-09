import { Button, Input, Select } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { usePatientGroup, usePatientGroups } from "../api/patientGroupApi";
import { GroupDetailDialog } from "../components/GroupDetailDialog";
import { GroupFormDialog } from "../components/GroupFormDialog";
import { groupColumns } from "../components/groupColumns";
import { useGroupPage } from "../hooks/useGroupPage";
import { GROUP_KIND, type GroupKind, type PatientGroupDto } from "../types";
import "../components/patient-group.css";

/**
 * Hồ sơ nhóm (/patient-group, function list 4.10). BlueDental-local — the
 * reference has no patient groups; see docs/clone/pages/patient-relations.md.
 */
export function PatientGroupPage() {
  const ability = useAbility("patientGroup");
  const state = useGroupPage();
  const { data: page, isLoading } = usePatientGroups(state.query);
  const detail = usePatientGroup(state.viewingId);
  const filtered = Boolean(state.query.filter || state.kind);
  const openNew = ability.canCreate ? state.openNew : undefined;

  return (
    <div className="reception-page">
      <PageHeader title={t("PatientGroup:PageTitle")} subtitle={t("PatientGroup:PageSubtitle")} />
      <div className="page-card pg-panel">
        <div className="pg-toolbar">
          <div className="pg-toolbar__filters">
            <Input
              allowClear
              value={state.keyword}
              prefix={<SearchOutlined />}
              className="pg-search"
              placeholder={t("PatientGroup:SearchPlaceholder")}
              aria-label={t("PatientGroup:SearchPlaceholder")}
              onChange={(event) => state.setKeyword(event.target.value)}
            />
            <Select<GroupKind>
              allowClear
              value={state.kind}
              className="pg-filter"
              placeholder={t("PatientGroup:Field:Kind")}
              aria-label={t("PatientGroup:Field:Kind")}
              onChange={(value) => state.setKind(value ?? undefined)}
              options={[
                { value: GROUP_KIND.Family, label: t("PatientGroup:Kind:Family") },
                { value: GROUP_KIND.Other, label: t("PatientGroup:Kind:Other") },
              ]}
            />
          </div>
          {openNew ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
              {t("PatientGroup:Create")}
            </Button>
          ) : null}
        </div>

        {!isLoading && page?.totalCount === 0 && !filtered ? (
          <EmptyState
            title={t("PatientGroup:Empty")}
            description={t("PatientGroup:EmptyHint")}
            actionLabel={openNew ? t("PatientGroup:Create") : undefined}
            onAction={openNew}
          />
        ) : (
          <DataTable<PatientGroupDto>
            rowKey="id"
            loading={isLoading}
            dataSource={page?.items ?? []}
            columns={groupColumns({
              onView: state.view,
              onEdit: ability.canUpdate ? state.openEditRow : undefined,
              onDelete: ability.canDelete ? state.askDelete : undefined,
            })}
            totalCount={page?.totalCount ?? 0}
            page={state.page}
            pageSize={state.pageSize}
            onPageChange={state.setPage}
            scroll={{ x: 1300 }}
          />
        )}
      </div>

      <GroupDetailDialog
        open={state.viewingId !== null}
        group={detail.data}
        loading={detail.isLoading}
        onEdit={ability.canUpdate ? state.openEdit : undefined}
        onClose={state.closeView}
      />
      <GroupFormDialog
        editing={state.editing}
        saving={state.saving}
        onSubmit={(input) => void state.save(input)}
        onClose={state.closeForm}
      />
      <ConfirmDeleteDialog
        open={state.deleting !== null}
        noun={t("PatientGroup:Noun")}
        name={state.deleting?.name}
        pending={state.removing}
        onConfirm={() => void state.confirmDelete()}
        onClose={state.cancelDelete}
      />
    </div>
  );
}
