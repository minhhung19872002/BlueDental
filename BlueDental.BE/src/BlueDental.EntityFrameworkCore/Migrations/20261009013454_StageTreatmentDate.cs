using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class StageTreatmentDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "TreatmentDate",
                table: "bd_treatment_stages",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            // Rows written before Ngày điều trị existed were worked the day they
            // were written: their clinic-local (UTC+7) CreationTime day.
            migrationBuilder.Sql(
                """
                UPDATE bd_treatment_stages
                SET "TreatmentDate" = ("CreationTime" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TreatmentDate",
                table: "bd_treatment_stages");
        }
    }
}
