# F-64 — Mối quan hệ (4.8) · Hồ sơ nhóm (4.10) · người nhà của thẻ trả trước (3.1)

Status: `VERIFIED` · Verified on: uncommitted work on `feat/prepaid-card-family` over `26f09a84` (2026-10-12)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/patient-relations.md`.
Since 2026-10-12 (R-917) Người giám hộ (4.9), Mối quan hệ and the family group are joined
where they are written: a guardian picked from a hồ sơ with a kinship pill writes and owns the
pair's relation, and a family group writes each member's relation to its Chủ hộ.

## Runtime evidence

Production build (`vite preview` :8136), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. Every run registers its own patients.

`e2e/patient-relations.spec.ts` **3/3**:

| Case | What is checked |
|------|-----------------|
| API: relations, family group, family card | Child → father declared Parent; the father's record reads Child. Reverse pair → `0002`, self → `0001`. Family group (father head, mother with `relationToHead` Spouse, child with its relation on file) → members in order, the child's relation to the head = Child; a second family group with the child → `0008`; `by-patient` returns the group; the child's người nhà = father + mother. Family card owned by the child: mother + cousin with no relation → `PrepaidCard:0020`; with the cousin declared Relative → sold, the relation recorded |
| API: guardian → relation | A 9-year-old created with the father's own hồ sơ as guardian, pill "Bố" → **one** row for the father (Parent, `setByGuardian`, `guardianRelation` 1, a relationship id); the father reads Child, "Được giám hộ". PUT / DELETE of that relation → `0012`; a family group saying the child is the head's Sibling → `0012`; saying nothing → 200, relation to the head = Child. The card changed to "Ông" through `PUT patients/{id}/guardians` → the relation becomes Grandparent, still one row, `inFamilyGroup` |
| UI | "Gia đình & Quan hệ" opens from the hồ sơ editor's third pill: Hồ sơ nhóm band says "Chưa thuộc nhóm gia đình nào.", Người nhà & quan hệ is empty. "Thêm mối quan hệ" → the row reads "Mẹ"; her record reads "Con". `/patient-group?new=<child>` + the sister with "Anh/Chị/Em" → saved; after a reload "Xem nhóm …" opens it. Back on the record: the band shows the group and "Chủ hộ: <child>"; the sister is **one** row with "Chị/Em gái" and "Cùng nhóm gia đình". "Bán thẻ" offers the mother as a chip; sold with her as the only member |

`e2e/patient-groups.spec.ts` **2/2**: family without a head → `0009`, member with no relation →
`0010`, a friend → `0011`; the mother's relation given with the group is read back once on her
record (`inFamilyGroup`). UI: Lưu with the sister's relation missing shows "Chọn quan hệ với chủ hộ
cho …" under the field and sends no POST; picking "Anh/Chị/Em" saves, and the child reads the sister
as Sibling.

Regression: `patient-guardian` 1/1, `patient-guardian-detail` 1/1 (guardian rows in the one list),
`patient-guardian-api` 8/8, `prepaid-card` 4/4. Total **19/19**.

## Backend

- Domain: `PatientRelationTests` (guardian pill → relation: six kinship pills map to family
  relations; "Người giám hộ hợp pháp" / "Khác" map to none).
- Application: `PatientRelationAppServiceContractTests` (leaves; no public method outside the
  interfaces).
- Migration `PatientRelationsAndGroups`: `bd_patient_relationships`, `bd_patient_groups`,
  `bd_patient_group_members` (FKs to patients, cascade). Data migration
  `GuardianRelationships` (2026-10-12): relations for guardians already on file.
