# Permission Model — Reference Application

Source: `GET https://api.nfcdental.com/api/v1/user/me/permissions`
Observed: 2026-08-23 (read-only)

## Shape

```json
{
  "data": {
    "roleType": "clinicAdmin",
    "roleName": "<string>",
    "abilities": [ { "subject": "<subject>", "action": ["read", "create", ...] } ]
  }
}
```

The reference uses a **CASL-style ability model**: `(action, subject)` pairs, not
a flat permission-string list. The frontend gates UI by `can(action, subject)`.

## Observed role types

| roleType | roleName (VI) |
|----------|---------------|
| `clinicAdmin` | Quản lý phòng khám |

Other role names observed on `/staff` (role assignment column): `Bác Sĩ Điều Trị`,
`Lễ Tân`, `Kế Toán`. Their ability sets were NOT observed — `UNKNOWN_REFERENCE_BEHAVIOR`.

## Action vocabulary

| Action | Meaning |
|--------|---------|
| `read` | View list/detail |
| `create` | Create record |
| `update` | Edit record |
| `delete` | Soft-delete record |
| `export` | Export Excel/PDF |
| `approve` | Approve (expenses, materials) |
| `finalize` | Finalize payment (`payment` only) |
| `print` | Print (consultation, treatment stage) |
| `continue` / `complete` | Treatment stage transitions |
| `deposit` / `withdraw` / `transfer` | Cash management operations |
| `hidePhone` | Mask patient phone number |
| `attendanceOthers` | Check-in/out on behalf of another staff |
| `manage` | Full control (chatbot) |

## Full ability matrix — `clinicAdmin` (83 subjects)

| Subject | Actions |
|---------|---------|
| `account` | `read`, `update` |
| `appointment` | `read`, `create`, `update`, `delete`, `export` |
| `catalogConsultation` | `read`, `create`, `update`, `delete`, `export` |
| `catalogDiagnosis` | `read`, `create`, `update`, `delete`, `export` |
| `catalogHistory` | `read`, `create`, `update`, `delete`, `export` |
| `catalogMedicine` | `read`, `create`, `update`, `delete`, `export` |
| `catalogOccupation` | `read`, `create`, `update`, `delete` |
| `catalogPaymentMethod` | `read`, `create`, `update`, `delete` |
| `catalogPost` | `read`, `create`, `update`, `delete` |
| `catalogPrescription` | `read`, `create`, `update`, `delete`, `export` |
| `catalogRecordTag` | `read`, `create`, `update`, `delete` |
| `catalogService` | `read`, `create`, `update`, `delete`, `export` |
| `catalogSource` | `read`, `create`, `update`, `delete`, `export` |
| `catalogTemplate` | `read`, `create`, `update`, `delete`, `export` |
| `chatbot` | `read`, `create`, `update`, `delete`, `approve`, `manage` |
| `cskhCare` | `read`, `create`, `update`, `export` |
| `cskhGroup` | `read`, `create`, `update`, `export` |
| `helpSupport` | `read` |
| `laboBite` | `read`, `create`, `update`, `delete`, `export` |
| `laboFinishLine` | `read`, `create`, `update`, `delete`, `export` |
| `laboMaterial` | `read`, `create`, `update`, `delete`, `export` |
| `laboRhythm` | `read`, `create`, `update`, `delete`, `export` |
| `laboSupplier` | `read`, `create`, `update`, `delete`, `export` |
| `laboTemplate` | `read`, `create`, `update`, `export` |
| `materials` | `read`, `create`, `update`, `delete`, `approve`, `export` |
| `operationsAssistantHome` | `read`, `create`, `update`, `delete`, `export` |
| `operationsAssistantProcess` | `read`, `create`, `update`, `delete`, `export` |
| `operationsAssistantTask` | `read`, `create`, `update`, `delete`, `export` |
| `operationsCskhHome` | `read`, `create`, `update`, `delete`, `export` |
| `operationsCskhProcess` | `read`, `create`, `update`, `delete`, `export` |
| `operationsCskhReport` | `read`, `export` |
| `operationsCskhTask` | `read`, `create`, `update`, `delete`, `export` |
| `operationsFinanceAccess` | `read`, `export` |
| `operationsFinanceHome` | `read`, `create`, `update`, `delete`, `export` |
| `operationsFinanceInvoice` | `read`, `export` |
| `operationsFinanceProcess` | `read`, `create`, `update`, `delete`, `export` |
| `operationsFinanceServiceComplete` | `read`, `export` |
| `operationsFinanceTask` | `read`, `create`, `update`, `delete`, `export` |
| `operationsMarketingHome` | `read`, `create`, `update`, `delete`, `export` |
| `operationsMarketingProcess` | `read`, `create`, `update`, `delete`, `export` |
| `operationsMarketingReport` | `read`, `export` |
| `operationsMarketingTask` | `read`, `create`, `update`, `delete`, `export` |
| `operationsOverviewDiagnosis` | `read`, `export` |
| `operationsOverviewHome` | `read`, `create`, `update`, `delete`, `export` |
| `operationsOverviewPrescription` | `read`, `export` |
| `operationsOverviewProcess` | `read`, `create`, `update`, `delete`, `export` |
| `operationsOverviewReport` | `read`, `export` |
| `operationsOverviewTask` | `read`, `create`, `update`, `delete`, `export` |
| `operationsReceptionHome` | `read`, `create`, `update`, `delete`, `export` |
| `operationsReceptionProcess` | `read`, `create`, `update`, `delete`, `export` |
| `operationsReceptionReport` | `read`, `export` |
| `operationsReceptionTask` | `read`, `create`, `update`, `delete`, `export` |
| `operationsSecurityHome` | `read`, `create`, `update`, `delete`, `export` |
| `operationsSecurityProcess` | `read`, `create`, `update`, `delete`, `export` |
| `operationsSecurityTask` | `read`, `create`, `update`, `delete`, `export` |
| `operationsTreatmentAccess` | `read`, `export` |
| `operationsTreatmentHome` | `read`, `create`, `update`, `delete`, `export` |
| `operationsTreatmentProcess` | `read`, `create`, `update`, `delete`, `export` |
| `operationsTreatmentReport` | `read`, `export` |
| `operationsTreatmentTask` | `read`, `create`, `update`, `delete`, `export` |
| `patient` | `read`, `create`, `update`, `hidePhone`, `export` |
| `payment` | `read`, `create`, `update`, `delete`, `export`, `finalize` |
| `prescription` | `read`, `create`, `update`, `delete`, `export` |
| `reception` | `read`, `create`, `update`, `delete`, `export` |
| `reportCashflowCategory` | `read`, `create`, `update`, `delete`, `export` |
| `reportCost` | `read`, `create`, `update`, `delete`, `approve`, `export` |
| `reportIncome` | `read`, `create`, `update`, `delete`, `export` |
| `reportResult` | `read`, `export` |
| `reportSales` | `read`, `export` |
| `reportTransfer` | `read`, `update`, `delete`, `deposit`, `withdraw`, `transfer`, `export` |
| `reportTransferCategory` | `read`, `create`, `update`, `delete` |
| `rolePermission` | `read`, `create`, `update`, `delete` |
| `staff` | `read`, `create`, `update`, `delete`, `export` |
| `toolCall` | `read`, `create`, `update`, `delete`, `export` |
| `toolMessage` | `read`, `create`, `update`, `delete`, `export` |
| `treatmentConsultation` | `read`, `create`, `update`, `delete`, `print` |
| `treatmentCskh` | `read`, `create`, `update`, `delete`, `export` |
| `treatmentDiagnosis` | `read`, `create`, `update`, `delete` |
| `treatmentImage` | `read`, `create`, `update`, `delete`, `export` |
| `treatmentLabo` | `read`, `create`, `update`, `delete`, `export` |
| `treatmentStage` | `read`, `create`, `update`, `continue`, `complete`, `print` |
| `voucher` | `read`, `create`, `update`, `delete`, `export` |
| `workSchedule` | `read`, `update`, `attendanceOthers` |
## Subject → module mapping

| Module | Subjects |
|--------|----------|
| Account / Identity | `account`, `staff`, `rolePermission`, `workSchedule` |
| Reception | `reception` |
| Patient | `patient` |
| Appointment | `appointment` |
| Treatment | `treatmentConsultation`, `treatmentDiagnosis`, `treatmentStage`, `treatmentImage`, `treatmentLabo`, `treatmentCskh`, `prescription` |
| CSKH | `cskhCare`, `cskhGroup` |
| Labo | `laboTemplate`, `laboSupplier`, `laboBite`, `laboFinishLine`, `laboRhythm`, `laboMaterial` |
| Catalog (Danh mục) | `catalogService`, `catalogDiagnosis`, `catalogMedicine`, `catalogConsultation`, `catalogSource`, `catalogHistory`, `catalogPrescription`, `catalogTemplate`, `catalogRecordTag`, `catalogPaymentMethod`, `catalogOccupation`, `catalogPost` |
| Materials | `materials` |
| Billing / Finance | `payment`, `voucher`, `reportSales`, `reportIncome`, `reportCost`, `reportResult`, `reportTransfer`, `reportTransferCategory`, `reportCashflowCategory` |
| Operations (8 khối × 3–6 sub) | `operations*` (34 subjects) |
| Tools | `toolCall`, `toolMessage`, `chatbot` |
| Help | `helpSupport` |

## Operations subject naming rule

```
operations<Department><Section>
Department ∈ Overview | Assistant | Reception | Cskh | Marketing | Security | Treatment | Finance
Section    ∈ Home | Process | Task | Report | Access | Diagnosis | Prescription | Invoice | ServiceComplete
```

Sections `Home`, `Process`, `Task` carry full CRUD + export.
Sections `Report`, `Access`, `Diagnosis`, `Prescription`, `Invoice`, `ServiceComplete`
are read-only + export.

## Implication for BlueDental

BlueDental uses ABP permissions (`BlueDentalPermissions`). Map
`(action, subject)` → `BlueDental.<Subject>.<Action>` permission names and
declare them in `BlueDentalPermissionDefinitionProvider`.
