using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Số ngoại trú becomes <c>NT-{xxxxxxxx}{MMdd}</c> (R-1305): the number is one
    /// running count per branch instead of a count per clinic day. Sets already
    /// opened are numbered again in the order they were opened, deleted ones too,
    /// so new sets go on from the branch's highest.
    /// </summary>
    public partial class OutpatientRunningNumberR1305 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                WITH numbered AS (
                    SELECT s."Id",
                           row_number() OVER (
                               PARTITION BY s."ClinicBranchId"
                               ORDER BY s."CreationTime", s."Id") AS "Sequence"
                    FROM bd_medical_record_sets s
                )
                UPDATE bd_medical_record_sets s
                SET "OutpatientSequence" = n."Sequence"
                FROM numbered n
                WHERE n."Id" = s."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Back to a count per branch per clinic day, as 20261019032741 gave it.
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
                WHERE n."Id" = s."Id";
                """);
        }
    }
}
