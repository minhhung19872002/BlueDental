using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Lịch sử thay đổi lịch hẹn — one row per change to an appointment.
    ///
    /// The reference reads it behind <c>GET /schedule-logs?patientId=…</c> and
    /// <c>GET /schedule-logs/stats</c>: who did what, from where, and the
    /// appointment before and after (as JSON in <c>ChangesJson</c>). Rows are
    /// written once and never edited, so the table is not audited; it keeps
    /// its own <c>OccurredAt</c>, which also lets the backfill seeder date the
    /// "created" row of an existing appointment at its real creation time.
    /// See docs/clone/pages/patient-detail.md §Lịch sử thay đổi.
    ///
    /// Hand-written for the reason given in AddDepartmentSortOrder: the model
    /// snapshot has drifted for unrelated entities, so a scaffolded migration
    /// would sweep up changes that belong to other work.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260905000000_AddAppointmentChangeLog")]
    public partial class AddAppointmentChangeLog : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_appointment_change_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<short>(type: "smallint", nullable: false),
                    Source = table.Column<short>(type: "smallint", nullable: false),
                    StatusBefore = table.Column<short>(type: "smallint", nullable: true),
                    StatusAfter = table.Column<short>(type: "smallint", nullable: true),
                    ChangedFields = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ChangesJson = table.Column<string>(type: "text", nullable: false),
                    IsImportant = table.Column<bool>(type: "boolean", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ActorUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ActorRole = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Browser = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    OperatingSystem = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExtraProperties = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_appointment_change_logs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_appointment_change_logs_AppointmentId",
                table: "bd_appointment_change_logs",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_appointment_change_logs_BranchId_OccurredAt",
                table: "bd_appointment_change_logs",
                columns: new[] { "BranchId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_appointment_change_logs_PatientId_OccurredAt",
                table: "bd_appointment_change_logs",
                columns: new[] { "PatientId", "OccurredAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_appointment_change_logs");
        }
    }
}
