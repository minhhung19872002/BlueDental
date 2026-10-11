-- =====================================================================
-- BlueDental — xoá toàn bộ dữ liệu, CHỈ GIỮ:
--   * dữ liệu 11 tab Danh mục (/taxonomy)
--   * tài khoản "admin" (cùng vai trò, quyền của nó)
--   * khung hệ thống: chi nhánh, vai trò, bảng quyền, cấu hình, OpenIddict,
--     lịch sử migration, kết nối đồng bộ Danh mục dịch vụ
--   * chỉ chi nhánh BD-001 (3 chi nhánh test xoá kèm Danh mục của chúng)
-- Zalo OA, cấu hình HĐĐT, vai trò test: xoá (BA chốt, 2026-10-11).
--
-- Chạy thử (mặc định ROLLBACK, không đổi gì):
--   docker compose exec -T postgres psql -U <user> -d <db> < clear-all-except-catalog.sql
-- Chạy thật (COMMIT):
--   docker compose exec -T postgres psql -U <user> -d <db> -v DO_COMMIT=1 < clear-all-except-catalog.sql
--
-- TRƯỚC KHI CHẠY: production phải đang chạy bản có BlueDentalDemoSeedContributor
-- chỉ seed ở Development — nếu không, lần deploy/migrator kế tiếp thấy chi nhánh
-- trống bệnh nhân sẽ seed lại bệnh nhân, nha sĩ, hoá đơn demo.
--
-- Bảng nào KHÔNG có trong _keep đều bị TRUNCATE (kể cả bảng mới thêm sau này).
-- Không dùng CASCADE: khoá ngoại bất ngờ → lỗi → huỷ cả giao dịch.
-- =====================================================================
\set ON_ERROR_STOP on
\pset pager off

BEGIN;
-- TRUNCATE cần khoá độc quyền: app còn giữ bảng nào thì huỷ, không treo cả hệ thống
SET LOCAL lock_timeout = '10s';

-- ---------------------------------------------------------------------
-- 1. Bảng được GIỮ (một số bảng sẽ được lọc bớt dòng ở bước 4)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _keep (t text PRIMARY KEY);
INSERT INTO _keep (t) VALUES
  -- Hệ thống
  ('__EFMigrationsHistory'),
  ('AbpClaimTypes'), ('AbpFeatureGroups'), ('AbpFeatures'), ('AbpFeatureValues'),
  ('AbpOrganizationUnits'), ('AbpOrganizationUnitRoles'),
  ('AbpPermissionGroups'), ('AbpPermissions'), ('AbpPermissionGrants'),
  ('AbpRoles'), ('AbpRoleClaims'), ('AbpSettingDefinitions'), ('AbpSettings'),
  ('OpenIddictApplications'), ('OpenIddictScopes'),
  -- Tài khoản: chỉ còn admin sau bước 4
  ('AbpUsers'), ('AbpUserRoles'), ('AbpUserClaims'), ('AbpUserLogins'),
  ('AbpUserTokens'), ('AbpUserOrganizationUnits'),
  -- Chi nhánh: dữ liệu Danh mục gắn theo chi nhánh
  ('bd_clinic_branches'),
  -- Danh mục
  ('bd_taxonomies'), ('bd_catalog_entries'), ('bd_catalog_service_configs'),
  ('bd_catalog_service_stages'), ('bd_catalog_medicines'), ('bd_catalog_combo_items'),
  ('bd_prescription_template_lines'), ('bd_payment_accounts'), ('bd_patient_tags'),
  ('bd_patient_sources'), ('bd_occupations'), ('bd_diagnoses'), ('bd_medication_types'),
  ('bd_consulting_data'), ('bd_medical_history_types'), ('bd_prescription_templates'),
  ('bd_medical_record_templates'), ('bd_dental_procedures'),
  -- Đồng bộ Danh mục dịch vụ giữa phòng khám
  ('bd_clinic_connections'), ('bd_service_catalog_sync_states');

-- Nhóm trong bd_taxonomies KHÔNG thuộc Danh mục (Labo, Vật tư) → xoá
CREATE TEMP TABLE _drop_taxonomy_groups (g text PRIMARY KEY);
INSERT INTO _drop_taxonomy_groups (g) VALUES
  ('labo_bite'), ('labo_finish_line'), ('labo_material'), ('labo_rhythm'), ('supplies');

-- Chi nhánh test xoá hẳn, kèm Danh mục của chúng (BA chốt, 2026-10-11)
CREATE TEMP TABLE _drop_branch_codes (code text PRIMARY KEY);
INSERT INTO _drop_branch_codes (code) VALUES ('DUNGTEST01'), ('VN0005S-Dung0024'), ('TEST');

-- Vai trò test xoá hẳn (BA chốt, 2026-10-11)
CREATE TEMP TABLE _drop_roles (name text PRIMARY KEY);
INSERT INTO _drop_roles (name) VALUES ('22092026_02 Vai Tro Test'), ('DUNG-TEST Vai tro');

-- ---------------------------------------------------------------------
-- 2. Đếm trước
-- ---------------------------------------------------------------------
CREATE TEMP VIEW _row_counts AS
SELECT c.relname AS table_name,
       EXISTS (SELECT 1 FROM _keep k WHERE k.t = c.relname) AS kept,
       (xpath('/row/n/text()',
              query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname),
                           false, true, '')))[1]::text::bigint AS row_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

CREATE TEMP TABLE _before AS SELECT * FROM _row_counts;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AbpUsers" WHERE "UserName" = 'admin') THEN
    RAISE EXCEPTION 'Khong tim thay tai khoan admin — dung lai, khong xoa gi.';
  END IF;
  -- admin mặc định vào BD-001 (BlueDentalDataSeedContributor.DefaultBranchId)
  IF NOT EXISTS (SELECT 1 FROM bd_clinic_branches
                 WHERE "Id" = '11111111-1111-1111-1111-111111111111'
                   AND "Code" NOT IN (SELECT code FROM _drop_branch_codes)) THEN
    RAISE EXCEPTION 'Chi nhanh mac dinh BD-001 khong con sau khi xoa — dung lai.';
  END IF;
  IF EXISTS (SELECT 1 FROM _drop_branch_codes d
             WHERE NOT EXISTS (SELECT 1 FROM bd_clinic_branches b WHERE b."Code" = d.code)) THEN
    RAISE EXCEPTION 'Co ma chi nhanh trong _drop_branch_codes khong ton tai — kiem tra lai.';
  END IF;
  IF EXISTS (SELECT 1 FROM _drop_roles d
             WHERE NOT EXISTS (SELECT 1 FROM "AbpRoles" r WHERE r."Name" = d.name)) THEN
    RAISE EXCEPTION 'Co ten vai tro trong _drop_roles khong ton tai — kiem tra lai.';
  END IF;
  IF EXISTS (SELECT 1 FROM _drop_roles d
             JOIN "AbpRoles" r ON r."Name" = d.name
             JOIN "AbpUserRoles" ur ON ur."RoleId" = r."Id"
             JOIN "AbpUsers" u ON u."Id" = ur."UserId" AND u."UserName" = 'admin') THEN
    RAISE EXCEPTION 'Khong duoc xoa vai tro ma admin dang dung.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. TRUNCATE mọi bảng không nằm trong _keep
-- ---------------------------------------------------------------------
DO $$
DECLARE
  targets text;
BEGIN
  SELECT string_agg(format('public.%I', table_name), ', ' ORDER BY table_name)
    INTO targets
    FROM _before
   WHERE NOT kept;

  RAISE NOTICE 'TRUNCATE %', targets;
  EXECUTE 'TRUNCATE TABLE ' || targets;
END $$;

-- ---------------------------------------------------------------------
-- 4. Lọc dòng trong các bảng được giữ
-- ---------------------------------------------------------------------
DO $$
DECLARE
  admin_id uuid := (SELECT "Id" FROM "AbpUsers" WHERE "UserName" = 'admin');
  drop_branch_ids uuid[] := ARRAY(SELECT b."Id" FROM bd_clinic_branches b
                                   JOIN _drop_branch_codes d ON d.code = b."Code");
  r record;
  n bigint;
BEGIN
  -- 4a. Tài khoản: chỉ còn admin. Khoá ngoại xoá kèm UserRoles/Claims/Logins/Tokens/OU.
  DELETE FROM "AbpUsers" WHERE "Id" <> admin_id;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'Xoa % tai khoan', n;
  DELETE FROM "AbpPermissionGrants" WHERE "ProviderName" = 'U' AND "ProviderKey" <> admin_id::text;
  DELETE FROM "AbpSettings"         WHERE "ProviderName" = 'U' AND "ProviderKey" <> admin_id::text;

  -- 4b. Vai trò được chọn xoá
  DELETE FROM "AbpPermissionGrants"
   WHERE "ProviderName" = 'R' AND "ProviderKey" IN (SELECT name FROM _drop_roles);
  DELETE FROM "AbpRoles" WHERE "Name" IN (SELECT name FROM _drop_roles);

  -- 4c. Nhóm Labo / Vật tư nằm chung bảng bd_taxonomies
  DELETE FROM bd_catalog_entries
   WHERE "TaxonomyId" IN (SELECT "Id" FROM bd_taxonomies
                           WHERE "Group" IN (SELECT g FROM _drop_taxonomy_groups));
  DELETE FROM bd_taxonomies WHERE "Group" IN (SELECT g FROM _drop_taxonomy_groups);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'Xoa % nhom Labo/Vat tu', n;

  -- 4d. Nhà cung cấp Labo đã bị xoá → gỡ khỏi cấu hình dịch vụ, nếu không lần
  --     sửa dịch vụ kế tiếp bị chặn (Catalogs:0025, NCC không thuộc chi nhánh).
  UPDATE bd_catalog_service_configs SET "LaboSupplierIds" = '{}'
   WHERE cardinality("LaboSupplierIds") > 0;

  -- 4e. Chi nhánh được chọn xoá: mọi bảng được giữ có cột ClinicBranchId/BranchId
  IF cardinality(drop_branch_ids) > 0 THEN
    FOR r IN
      SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN _keep k ON k.t = c.table_name
       WHERE c.table_schema = 'public'
         AND c.column_name IN ('ClinicBranchId', 'BranchId')
         AND c.table_name <> 'bd_clinic_branches'
       ORDER BY (c.table_name = 'bd_catalog_entries'), c.table_name
    LOOP
      EXECUTE format('DELETE FROM public.%I WHERE %I = ANY($1)', r.table_name, r.column_name)
        USING drop_branch_ids;
    END LOOP;
    DELETE FROM bd_clinic_branches WHERE "Id" = ANY(drop_branch_ids);
    GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'Xoa % chi nhanh', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. Kết quả
-- ---------------------------------------------------------------------
\echo
\echo '=== Bang DUOC GIU: truoc -> sau ==='
SELECT b.table_name, b.row_count AS truoc, a.row_count AS sau
FROM _before b JOIN _row_counts a USING (table_name)
WHERE b.kept
ORDER BY b.table_name;

\echo
\echo '=== Bang khong giu nhung van con du lieu (phai rong) ==='
SELECT table_name, row_count FROM _row_counts WHERE NOT kept AND row_count <> 0;

\echo
\echo '=== Con lai ==='
SELECT 'Tai khoan' AS loai, string_agg("UserName", ', ') AS gia_tri FROM "AbpUsers"
UNION ALL
SELECT 'Chi nhanh', string_agg("Code", ', ' ORDER BY "Code") FROM bd_clinic_branches
UNION ALL
SELECT 'Vai tro', string_agg("Name", ', ' ORDER BY "Name") FROM "AbpRoles";

\if :{?DO_COMMIT}
  COMMIT;
  \echo '>>> DA COMMIT — da xoa, chi con Danh muc + admin.'
\else
  ROLLBACK;
  \echo '>>> CHAY THU — da ROLLBACK, khong co gi thay doi. Them -v DO_COMMIT=1 de chay that.'
\endif
