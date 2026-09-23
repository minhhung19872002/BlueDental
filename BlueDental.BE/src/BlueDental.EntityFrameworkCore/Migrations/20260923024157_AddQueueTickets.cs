using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddQueueTickets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_queue_tickets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    QueueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TicketNumber = table.Column<int>(type: "integer", nullable: false),
                    DisplayNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Priority = table.Column<short>(type: "smallint", nullable: false),
                    ServiceType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DentistId = table.Column<Guid>(type: "uuid", nullable: true),
                    CalledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ServingAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SkippedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CallCount = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_bd_queue_tickets", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_queue_tickets_ClinicBranchId_QueueDate_Status",
                table: "bd_queue_tickets",
                columns: new[] { "ClinicBranchId", "QueueDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_queue_tickets_ClinicBranchId_QueueDate_TicketNumber",
                table: "bd_queue_tickets",
                columns: new[] { "ClinicBranchId", "QueueDate", "TicketNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_queue_tickets_PatientId_QueueDate",
                table: "bd_queue_tickets",
                columns: new[] { "PatientId", "QueueDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_queue_tickets");
        }
    }
}
