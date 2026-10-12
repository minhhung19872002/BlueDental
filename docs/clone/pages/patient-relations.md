# Mối quan hệ · Hồ sơ nhóm · người nhà của thẻ trả trước

**BlueDental-local.** The reference (app.nfcdental.com) has no patient relations,
no patient groups and no family tab; nothing in docs/clone mentions one. Source:
the function list `Danh-muc-chuc-nang-nha-khoa-v2`:

- 4.8 *Mối quan hệ — Quản lý các hồ sơ có cùng mối quan hệ với nhau.*
- 4.9 *Người giám hộ* — already built and reviewed (`patient-guardian.md`); **not modified** here.
- 4.10 *Hồ sơ nhóm — Thiết lập và quản lý tập trung các hồ sơ có mối quan hệ y khoa. Giúp bác sĩ dễ dàng tra cứu và quản lý hồ sơ của các thành viên trong nhóm.*
- 3.1 *Thẻ trả trước … có thể áp dụng cho thành viên trong gia đình* — ties the family card to these records.

Designed together as one cluster on 2026-10-09 (owner: "xem xét thiết kế các chức
năng này cho phù hợp … tùy biến layout cho phù hợp với cụm chức năng liên quan
đến quan hệ / gia đình / nhóm / người giám hộ").

## One story: Mối quan hệ is the single answer to "what is X to Y"

Owner, 2026-10-12: guardians, relations and the family group were three stores
that only met when read, so a guardian "Bố" did not show as a relation and a
family group knew nobody's place in it. Now the data is joined where it is
**written** (the owner picked "Gắn cả dữ liệu"):

| Tie | Written where | What it writes |
|---|---|---|
| Mối quan hệ (`PatientRelationship`) | "Gia đình & Quan hệ" dialog; a family card shared with someone new; the two rows below | The pair's relation. Spouse, Parent, Child, Sibling, Grandparent, Grandchild, Relative are family; Friend, Colleague, Other are not |
| Guardian picked from a hồ sơ (`PatientGuardian.LinkedPatientId`, 4.9) with a kinship pill | The hồ sơ's Lưu (`PatientFamilyResolver.SyncGuardiansAsync`) | The pair's relation, as `PatientRelationTypes.KinshipOf`: Bố / Mẹ → Parent, Ông / Bà → Grandparent, Anh/Chị ruột → Sibling, Cô/Dì/Chú/Bác → Relative. The **card owns it**: changing the pill changes the relation; the relation list and a family group cannot change or delete it (`PatientRelation:0012`). Removing the guardian leaves the relation (still family) |
| Guardian with "Người giám hộ hợp pháp" / "Khác", or with no hồ sơ | The hồ sơ's Lưu | No relation: the pill says nothing about kinship. Still người nhà for the family card. A relation may be declared beside it |
| **Family** group (`PatientGroup`, kind Gia đình) | /patient-group | Needs a Chủ hộ (`0009`); every other member's relation to the Chủ hộ is picked in the form or already on file (`0010`) and must be family (`0011`). What is picked is written as the pair's relation |

Guardians already on file got their relation from the data migration
`GuardianRelationships` (pairs already related either way are left; the next save
of the ward's hồ sơ brings them in line with the card). Existing family groups are
not changed; the next save of one asks for the relations it lacks.

`PatientFamilyResolver.LinksOfAsync` returns **one link per person**: the declared
relation when there is one, plus `GuardianDirection` / `GuardianRelation` /
`SetByGuardian` and `InFamilyGroup`. The family card offers the same people as members.

## Mối quan hệ (4.8)

- Two records **of the same branch** (patient records are branch-scoped).
- Written **once** per pair: `Type` says what `RelatedPatientId` is to `PatientId`;
  the other record reads the inverse (Parent ↔ Child, Grandparent ↔ Grandchild,
  the rest symmetric). Either side may edit it. The reverse pair is refused
  (`PatientRelation:0002`), and so is a record related to itself (`0001`).
- Shown by the other person's gender: Bố / Mẹ, Vợ / Chồng, Ông / Bà, Anh-Em trai /
  Chị-Em gái; gender-neutral in the picker.
- Guarded by the **patient** leaves (part of the record): read = `patient.read`,
  write = `patient.update`. Guardian and group rows are read-only here.

## Hồ sơ nhóm (4.10) — `/patient-group`, menu Phòng khám after "Bệnh nhân"

- Kind **Gia đình** or **Nhóm khác** (a company, a class…); name; members (≤ 30,
  no repeat); at most one **Chủ hộ** / **Trưởng nhóm**. A family must have one, and
  each other member gets a "Là gì của chủ hộ" select (family relations only),
  prefilled from the relation on file and locked when a guardian card sets it.
  Changing the Chủ hộ clears the picks. Errors show under the members field.
  **Thông tin y khoa chung**
  (family history, hereditary conditions, common care notes, ≤ 2000); note.
- A record belongs to **one family group** at most (`0008`, naming the record and
  the group); any number of other groups.
- The group dialog shows the shared medical note first, then each member: role or
  relation to the Chủ hộ (from Mối quan hệ), age · gender, **Tiểu sử bệnh** (the
  record's Lịch sử bệnh entries; allergies in red), last visit, next appointment,
  debt (the patient list's own rollup), each name opening the record.
- List: search by group name or member name / code, filter by kind, sticky
  Thao tác column (Xem · Sửa · Xoá). Details and forms are dialogs.
- Links: the record's tab opens `/patient-group?open=<id>`, and "Tạo nhóm với hồ sơ
  này" opens the form seeded with the record as head (`?new=<patientId>`).
- New ability subject `patientGroup` (read / create / update / delete), granted to
  the manager roles like every subject.

## "Gia đình & Quan hệ" in the hồ sơ editor

No tab of its own (owner, 2026-10-09, R-863 / R-864): the third pill of "Chỉnh sửa
hồ sơ" / "Tạo hồ sơ", **Gia đình & Quan hệ**, is a button, not a tab — it opens
`PatientFamilyDialog` straight away (the column was too narrow to read a family in).

- The pill shares one row with the reference's two pills (Thông tin cơ bản, Tiểu sử
  bệnh — left untouched): it runs at 12px with 8px side padding, and the guardian
  mark (red dot = one owed, green tick = some in) is a corner badge, not inline.
- The dialog, 780px, one column (owner, 2026-10-12; it was three separate boxes):
  - **Hồ sơ nhóm** band on top: the family group (name, Chủ hộ, member count, shared
    medical note, "Mở hồ sơ nhóm"), or "Chưa thuộc nhóm gia đình nào" + "Tạo nhóm gia
    đình"; other groups as links. The members themselves are rows below.
  - **Người nhà & quan hệ**: one row per person (`buildFamilyPeople`). The editor's
    guardian cards come first (staged, written by the hồ sơ's Lưu, so an under-16
    record still cannot be saved without one, F-50), each joined with its hồ sơ's
    relation row; then everyone else, family first. Tags: relation, Người giám hộ /
    Được giám hộ, Cùng nhóm gia đình, Liên hệ chính, Chưa có hồ sơ, Chưa lưu.
  - A guardian row is edited in the guardian popup, a declared relation in its
    dialog. A relation set by a guardian card shows a lock. A family-group member or
    legal guardian with no relation offers **Chọn quan hệ**. Header buttons: Thêm
    người giám hộ, Thêm mối quan hệ.
- "Tạo hồ sơ": relations and groups need a saved record, so the dialog narrows to
  600px with the guardians and a line saying to save first.
- A guardian refused by the server on save opens the dialog with the error.
- Names and group links open in a **new browser tab**: following them in place would
  leave the editor and drop what is typed.
- The record page no longer has a family tab; `?tab=family` falls back to the
  default. The Hồ sơ tab keeps the "Dưới 16 tuổi" chip and the guardian phone note.
- Prepaid cards are not here (they are money, not family): the strip under the money
  tiles of the Hồ sơ tab lists them.
- Trade-off: an account that can read but not update patients no longer sees the
  relations on the record; groups stay readable on /patient-group.

## Family prepaid card (3.1)

- A card whose type allows family is shared with **người nhà only**. The sale /
  members dialog offers the owner's người nhà as one-tap chips; anyone else may be
  searched for but must say what they are to the owner (family relations only),
  and that relation is recorded as a Mối quan hệ when the card is saved.
- Server rule on sale and on newly added members: not family and no family
  relation given → `PrepaidCard:0020`. Members already on a card stay.

## API

| Method | Path | |
|---|---|---|
| GET | `patient-relations?patientId=` | every link of the record |
| GET | `patient-relations/family?patientId=` | người nhà only |
| POST / PUT / DELETE | `patient-relations`, `patient-relations/{id}` | `{ patientId, relatedPatientId, type, note }` / `{ patientId, type, note }` |
| GET | `patient-groups` | `Filter`, `Kind`, paging |
| GET | `patient-groups/{id}`, `patient-groups/by-patient?patientId=` | with members' look-up facts |
| POST / PUT / DELETE | `patient-groups`, `patient-groups/{id}` | `{ name, kind, note, sharedMedicalNote, members: [{ patientId, role, relationToHead }] }`; `relationToHead` for family groups, null keeps the one on file |

Relation rows, one per person: `{ id, source, guardianDirection, guardianRelation,
setByGuardian, inFamilyGroup, relatedPatient…, type, isFamily, note }`.
`prepaid-cards` (sell) and `prepaid-cards/{id}/members` take `newRelations: [{ patientId, type }]`.
Errors `BlueDental:PatientRelation:0001`–`0012` (0009 family without a Chủ hộ, 0010 relation
to the Chủ hộ missing, 0011 not family, 0012 set by a guardian card), `BlueDental:PrepaidCard:0020`.

## Open — owner decisions

- Inferring relations through others (the mother is the father's wife and the father
  is the child's Bố, so the mother is the child's Mẹ). Not done: a family-group member
  with no relation to this record shows "Chưa rõ quan hệ" and **Chọn quan hệ**.
- A role with `patientGroup.update` but not `patient.update` writes relations through
  a family group, as the family card does through `prepaid-card`.
- Relations across branches (patient records are branch-scoped today).
- Medical alerts beyond Tiểu sử bệnh (`Patient.MedicalAlerts` / `BloodType` exist but
  no screen writes them).
- Suggesting relations from shared phone numbers or addresses.
