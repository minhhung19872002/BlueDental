using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Re-points công đoạn steps that a catalog edit cut loose.
    ///
    /// Until CatalogEntry.SyncStages, saving a service in Danh mục gave every
    /// one of its steps a fresh id, so a công đoạn's ticked steps pointed at ids
    /// that no longer existed: their names came back empty and "Tạo bảo hành"
    /// drew blank checkboxes.
    ///
    /// Only the unambiguous case is repaired: a công đoạn whose steps are
    /// **all** lost, on a service that now has exactly as many steps. The
    /// dialog always saved the table whole and in order, so the n-th lost step
    /// is the n-th step of the service today. Anything else is left as it is —
    /// the screens skip a step they cannot name rather than guess it.
    /// </summary>
    public partial class RepairOrphanedStageSteps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
WITH items AS (
    SELECT s.""Id"" AS stage_id,
           s.""ServiceId"" AS service_id,
           e.ordinality AS pos,
           e.value AS item,
           jsonb_array_length(s.""ServiceItems""::jsonb) AS n
    FROM bd_treatment_stages s,
         jsonb_array_elements(s.""ServiceItems""::jsonb) WITH ORDINALITY e
    WHERE jsonb_array_length(s.""ServiceItems""::jsonb) > 0
),
flagged AS (
    SELECT i.*,
           EXISTS (SELECT 1 FROM bd_catalog_service_stages c
                   WHERE c.""Id""::text = i.item->>'CatalogServiceStageId') AS found
    FROM items i
),
repairable AS (
    SELECT stage_id, service_id
    FROM flagged
    GROUP BY stage_id, service_id, n
    HAVING bool_and(NOT found)
       AND n = (SELECT count(*) FROM bd_catalog_service_stages c WHERE c.""CatalogEntryId"" = service_id)
),
steps AS (
    SELECT c.""CatalogEntryId"" AS service_id,
           c.""Id"" AS step_id,
           row_number() OVER (PARTITION BY c.""CatalogEntryId"" ORDER BY c.""SortOrder"", c.""Id"") AS pos
    FROM bd_catalog_service_stages c
),
rebuilt AS (
    SELECT f.stage_id,
           jsonb_agg(jsonb_set(f.item, '{CatalogServiceStageId}', to_jsonb(st.step_id::text)) ORDER BY f.pos) AS items
    FROM flagged f
    JOIN repairable r ON r.stage_id = f.stage_id
    JOIN steps st ON st.service_id = f.service_id AND st.pos = f.pos
    GROUP BY f.stage_id
)
UPDATE bd_treatment_stages s
SET ""ServiceItems"" = rebuilt.items
FROM rebuilt
WHERE s.""Id"" = rebuilt.stage_id;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The lost ids are gone for good; there is nothing to point back at.
        }
    }
}
