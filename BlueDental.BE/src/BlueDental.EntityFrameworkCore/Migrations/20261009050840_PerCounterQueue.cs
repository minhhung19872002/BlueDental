using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PerCounterQueue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_service_counters_ClinicBranchId_Name",
                table: "bd_service_counters");

            migrationBuilder.DropIndex(
                name: "IX_bd_queue_tickets_ClinicBranchId_QueueDate_TicketNumber",
                table: "bd_queue_tickets");

            migrationBuilder.AddColumn<bool>(
                name: "AutoResetDaily",
                table: "bd_service_counters",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DentistId",
                table: "bd_service_counters",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "LastIssuedDate",
                table: "bd_service_counters",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LastIssuedNumber",
                table: "bd_service_counters",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MinutesPerPatient",
                table: "bd_service_counters",
                type: "integer",
                nullable: false,
                defaultValue: 12);

            migrationBuilder.AddColumn<string>(
                name: "NumberPrefix",
                table: "bd_service_counters",
                type: "character varying(2)",
                maxLength: 2,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "StartNumber",
                table: "bd_service_counters",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "WaitWarningMinutes",
                table: "bd_service_counters",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            // Existing counters get A, B, C… per branch in their display order
            // (past Z: Z1, Z2…), so the prefix index below can be unique.
            migrationBuilder.Sql("""
                UPDATE bd_service_counters AS c
                SET "NumberPrefix" = CASE WHEN o.rn <= 26 THEN chr(64 + o.rn::int) ELSE 'Z' || (o.rn - 26)::text END
                FROM (
                    SELECT "Id", row_number() OVER (PARTITION BY "ClinicBranchId" ORDER BY "IsDeleted", "SortOrder", "Name") AS rn
                    FROM bd_service_counters
                ) AS o
                WHERE c."Id" = o."Id";
                """);

            // The shared pool is gone: a number nobody's counter owns can never
            // be called again, so it leaves the queue (Expired = 6).
            migrationBuilder.Sql("""
                UPDATE bd_queue_tickets SET "Status" = 6
                WHERE "CounterId" IS NULL AND "Status" IN (1, 2, 3);
                """);

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_counters_ClinicBranchId_Name",
                table: "bd_service_counters",
                columns: new[] { "ClinicBranchId", "Name" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_counters_ClinicBranchId_NumberPrefix",
                table: "bd_service_counters",
                columns: new[] { "ClinicBranchId", "NumberPrefix" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_counters_DentistId",
                table: "bd_service_counters",
                column: "DentistId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_queue_tickets_CounterId_QueueDate_Status",
                table: "bd_queue_tickets",
                columns: new[] { "CounterId", "QueueDate", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_service_counters_ClinicBranchId_Name",
                table: "bd_service_counters");

            migrationBuilder.DropIndex(
                name: "IX_bd_service_counters_ClinicBranchId_NumberPrefix",
                table: "bd_service_counters");

            migrationBuilder.DropIndex(
                name: "IX_bd_service_counters_DentistId",
                table: "bd_service_counters");

            migrationBuilder.DropIndex(
                name: "IX_bd_queue_tickets_CounterId_QueueDate_Status",
                table: "bd_queue_tickets");

            migrationBuilder.DropColumn(
                name: "AutoResetDaily",
                table: "bd_service_counters");

            migrationBuilder.DropColumn(
                name: "DentistId",
                table: "bd_service_counters");

            migrationBuilder.DropColumn(
                name: "LastIssuedDate",
                table: "bd_service_counters");

            migrationBuilder.DropColumn(
                name: "LastIssuedNumber",
                table: "bd_service_counters");

            migrationBuilder.DropColumn(
                name: "MinutesPerPatient",
                table: "bd_service_counters");

            migrationBuilder.DropColumn(
                name: "NumberPrefix",
                table: "bd_service_counters");

            migrationBuilder.DropColumn(
                name: "StartNumber",
                table: "bd_service_counters");

            migrationBuilder.DropColumn(
                name: "WaitWarningMinutes",
                table: "bd_service_counters");

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_counters_ClinicBranchId_Name",
                table: "bd_service_counters",
                columns: new[] { "ClinicBranchId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_queue_tickets_ClinicBranchId_QueueDate_TicketNumber",
                table: "bd_queue_tickets",
                columns: new[] { "ClinicBranchId", "QueueDate", "TicketNumber" },
                unique: true);
        }
    }
}
