using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Two nullable columns on bd_visits, so reception can record how a visit
    /// ended.
    ///
    /// Written by hand rather than scaffolded. `dotnet ef migrations add` run
    /// against this project produced a five-hundred-line diff that dropped
    /// columns from bd_prescriptions, renamed three more, and recreated four
    /// tables that already exist in the database — none of which this change
    /// asks for. The model snapshot agrees with the previous migration's
    /// designer, so that diff came from the scaffolder reading a stale
    /// assembly, not from real drift. Applying it would have destroyed data.
    /// </summary>
    public partial class AddVisitOutcome : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "Outcome",
                table: "bd_visits",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OutcomeRecordedAt",
                table: "bd_visits",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Outcome",
                table: "bd_visits");

            migrationBuilder.DropColumn(
                name: "OutcomeRecordedAt",
                table: "bd_visits");
        }
    }
}
