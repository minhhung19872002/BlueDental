using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class TreatmentServiceTaxRate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "TaxRate",
                table: "bd_treatment_services",
                type: "smallint",
                nullable: true);

            // Slips nobody has paid anything on yet take their services' "% thuế"
            // now, so what they ask for matches the catalog's "Thực thu gồm VAT".
            // A slip with a receipt keeps charging what was agreed (its lines stay
            // NULL = no VAT): adding VAT there would put the patient in debt for
            // money already settled.
            migrationBuilder.Sql("""
                UPDATE bd_treatment_services AS s
                SET "TaxRate" = c."TaxRate"
                FROM bd_catalog_service_configs AS c
                WHERE c."CatalogEntryId" = s."ServiceId"
                  AND NOT EXISTS (
                      SELECT 1 FROM bd_patient_payments AS p
                      WHERE p."TreatmentPlanId" = s."TreatmentPlanId"
                        AND p."IsDeleted" = FALSE);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TaxRate",
                table: "bd_treatment_services");
        }
    }
}
