# F-02 — Danh mục (taxonomy + catalog entries)

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The single screen behind all twelve "Danh mục" sub-routes of the reference: a
group list on the left, the entries of the selected group on the right.

## API surface

```
GET    /api/v1/app/taxonomies?clinicBranchId&group&includeCount
POST   /api/v1/app/taxonomies
PUT    /api/v1/app/taxonomies/{id}
DELETE /api/v1/app/taxonomies/{id}
GET    /api/v1/app/catalog-entries?clinicBranchId&group&taxonomyId&filter
POST   /api/v1/app/catalog-entries
PUT    /api/v1/app/catalog-entries/{id}
DELETE /api/v1/app/catalog-entries/{id}
```

## Rules under test

- A group belongs to one catalog (`group` slug); entries inherit it from the
  group and can only move between groups of the same catalog.
- Price is accepted only for `care_service`, `medication_type`, `supplies`.
- Template content is accepted only for `prescription_template` and
  `medical_record_template`.
- System groups cannot be renamed, deactivated or deleted.
- A group with entries cannot be deleted.
- Each catalog is guarded by its own ability subject via `TaxonomyGroupAbilities`.

## Acceptance evidence

`e2e/taxonomy.spec.ts`:

1. creates a group, creates a 180.000 đ service inside it, asserts the row shows
   the price and the group, then reloads and asserts it is still there
2. asserts the selected catalog lives in the URL
3. asserts the two unmodelled catalogs say why they are empty

## Not covered yet

- Editing and deleting entries through the UI (server rules are unit-tested)
- Reordering (`sortOrder`) — no drag handle wired
- `Thẻ hồ sơ` and `Phương thức thanh toán`: the reference models these outside
  the taxonomy pattern; BlueDental has no entity for them yet
