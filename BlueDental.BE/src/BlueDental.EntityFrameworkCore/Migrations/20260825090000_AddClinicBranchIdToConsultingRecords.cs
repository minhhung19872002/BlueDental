using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// The branch column both consulting tables were queried by but never had.
    ///
    /// `ConsultationRecord` and `DiagnosticRecord` carry `ClinicBranchId`, and
    /// their app services filter every list and every single read by it, but no
    /// migration ever added the column. Postgres answered 42703 — "column
    /// b.ClinicBranchId does not exist" — so both endpoints were a guaranteed
    /// 500 on any install. Nothing in the running frontend calls them yet,
    /// which is why it stayed hidden; seeding those tables is what found it.
    ///
    /// Written by hand for the same reason as AddVisitOutcome: scaffolding this
    /// change produced a diff that dropped seven columns from bd_labo_orders
    /// and recreated twenty-six tables that already exist, including the two
    /// this migration touches. That comes from the scaffolder reading a stale
    /// assembly, not from real drift, and applying it would have destroyed
    /// data.
    ///
    /// Existing rows fall to the default branch. Both tables were empty on
    /// every install when this was written, so the default is a formality that
    /// keeps the column non-null.
    /// </summary>
    public partial class AddClinicBranchIdToConsultingRecords : Migration
    {
        private static readonly Guid DefaultBranchId =
            new("11111111-1111-1111-1111-111111111111");

        private static readonly string[] ConsultingTables =
            ["bd_consultation_records", "bd_diagnostic_records"];

        private static readonly string[] ToolsTables =
            ["bd_call_assignments", "bd_call_logs", "bd_message_logs", "bd_message_templates"];

        private static readonly string[] AllTables = [.. ConsultingTables, .. ToolsTables];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ClinicBranchId",
                table: "bd_consultation_records",
                type: "uuid",
                nullable: false,
                defaultValue: DefaultBranchId);

            migrationBuilder.AddColumn<Guid>(
                name: "ClinicBranchId",
                table: "bd_diagnostic_records",
                type: "uuid",
                nullable: false,
                defaultValue: DefaultBranchId);

            // The four Công cụ tables have the same hole: every entity carries
            // ClinicBranchId, ToolsAppService filters all four lists by it, and
            // no column was ever created.
            foreach (var table in ToolsTables)
            {
                migrationBuilder.AddColumn<Guid>(
                    name: "ClinicBranchId",
                    table: table,
                    type: "uuid",
                    nullable: false,
                    defaultValue: DefaultBranchId);
            }

            foreach (var table in AllTables)
            {
                migrationBuilder.CreateIndex(
                    name: $"IX_{table}_ClinicBranchId",
                    table: table,
                    column: "ClinicBranchId");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in AllTables)
            {
                migrationBuilder.DropIndex(name: $"IX_{table}_ClinicBranchId", table: table);
                migrationBuilder.DropColumn(name: "ClinicBranchId", table: table);
            }
        }
    }
}
