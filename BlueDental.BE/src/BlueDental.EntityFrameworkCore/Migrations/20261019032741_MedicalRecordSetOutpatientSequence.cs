using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class MedicalRecordSetOutpatientSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OutpatientSequence",
                table: "bd_medical_record_sets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Sets opened before the number existed get one as if it had: the
            // branch's sets opened that clinic day, oldest first.
            migrationBuilder.Sql("""
                WITH numbered AS (
                    SELECT s."Id",
                           row_number() OVER (
                               PARTITION BY s."ClinicBranchId", (s."CreationTime" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                               ORDER BY s."CreationTime", s."Id") AS "Sequence"
                    FROM bd_medical_record_sets s
                )
                UPDATE bd_medical_record_sets s
                SET "OutpatientSequence" = n."Sequence"
                FROM numbered n
                WHERE n."Id" = s."Id" AND s."OutpatientSequence" = 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OutpatientSequence",
                table: "bd_medical_record_sets");
        }
    }
}
