using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddStageContinuationChain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ContinuedFromId",
                table: "bd_treatment_stages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsSuperseded",
                table: "bd_treatment_stages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "WarrantyRootStageId",
                table: "bd_treatment_stages",
                type: "uuid",
                nullable: true);

            // Before chains existed, a line's newest công đoạn was the live one
            // and every earlier one was greyed out in the history. Carry that
            // over: an unfinished công đoạn with a newer sibling on its line is
            // superseded. Finished ones stay live — a finished công đoạn is
            // never continued, and it is what a warranty is raised from.
            migrationBuilder.Sql(@"
UPDATE bd_treatment_stages AS s
SET ""IsSuperseded"" = TRUE
WHERE s.""IsDeleted"" = FALSE
  AND s.""Status"" <> 3
  AND EXISTS (
      SELECT 1 FROM bd_treatment_stages AS n
      WHERE n.""TreatmentServiceId"" = s.""TreatmentServiceId""
        AND n.""IsDeleted"" = FALSE
        AND n.""CreationTime"" > s.""CreationTime"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContinuedFromId",
                table: "bd_treatment_stages");

            migrationBuilder.DropColumn(
                name: "IsSuperseded",
                table: "bd_treatment_stages");

            migrationBuilder.DropColumn(
                name: "WarrantyRootStageId",
                table: "bd_treatment_stages");
        }
    }
}
