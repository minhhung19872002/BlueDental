using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddTreatmentServiceOriginalPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "OriginalPrice",
                table: "bd_treatment_services",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            // Existing lines open at their own price; a line pulled from a
            // consulting line whose list price was higher gets that list price,
            // so the lowered price reads as "Giảm dịch vụ" as on the reference.
            // What the patient owes does not change: it is still priced off Price.
            migrationBuilder.Sql("""
                UPDATE bd_treatment_services SET "OriginalPrice" = "Price";
                UPDATE bd_treatment_services s
                   SET "OriginalPrice" = a."OriginalPrice"
                  FROM bd_patient_advises a
                 WHERE s."SourceAdviseId" = a."Id"
                   AND a."OriginalPrice" > s."Price";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OriginalPrice",
                table: "bd_treatment_services");
        }
    }
}
