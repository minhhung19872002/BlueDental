using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AppointmentSeries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SeriesId",
                table: "bd_appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SeriesPlannedStart",
                table: "bd_appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_appointment_series",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DentistId = table.Column<Guid>(type: "uuid", nullable: false),
                    Frequency = table.Column<short>(type: "smallint", nullable: false),
                    Interval = table.Column<int>(type: "integer", nullable: false),
                    WeekDays = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    End = table.Column<short>(type: "smallint", nullable: false),
                    Count = table.Column<int>(type: "integer", nullable: true),
                    Until = table.Column<DateOnly>(type: "date", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_appointment_series", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_appointments_SeriesId",
                table: "bd_appointments",
                column: "SeriesId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_appointment_series_BranchId_PatientId",
                table: "bd_appointment_series",
                columns: new[] { "BranchId", "PatientId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_appointment_series");

            migrationBuilder.DropIndex(
                name: "IX_bd_appointments_SeriesId",
                table: "bd_appointments");

            migrationBuilder.DropColumn(
                name: "SeriesId",
                table: "bd_appointments");

            migrationBuilder.DropColumn(
                name: "SeriesPlannedStart",
                table: "bd_appointments");
        }
    }
}
