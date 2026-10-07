using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class MarketingTickets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_marketing_ticket_tags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaxProcessingDays = table.Column<int>(type: "integer", nullable: true),
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
                    table.PrimaryKey("PK_bd_marketing_ticket_tags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_marketing_tickets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SourceTaxonomyId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Channel = table.Column<short>(type: "smallint", nullable: false),
                    AssigneeId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SlaStartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsReturningCustomer = table.Column<bool>(type: "boolean", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    ProcessingDays = table.Column<int>(type: "integer", nullable: true),
                    DueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ContactCount = table.Column<int>(type: "integer", nullable: false),
                    LastContactAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastContactResult = table.Column<short>(type: "smallint", nullable: true),
                    NextCallAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NotPotentialReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DeleteReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TagIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
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
                    table.PrimaryKey("PK_bd_marketing_tickets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_marketing_ticket_activities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TicketId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<short>(type: "smallint", nullable: false),
                    ContactResult = table.Column<short>(type: "smallint", nullable: true),
                    FromStatus = table.Column<short>(type: "smallint", nullable: true),
                    ToStatus = table.Column<short>(type: "smallint", nullable: true),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    NextCallAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssigneeId = table.Column<Guid>(type: "uuid", nullable: true),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_marketing_ticket_activities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_marketing_ticket_activities_bd_marketing_tickets_TicketId",
                        column: x => x.TicketId,
                        principalTable: "bd_marketing_tickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_ticket_activities_TicketId_CreationTime",
                table: "bd_marketing_ticket_activities",
                columns: new[] { "TicketId", "CreationTime" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_ticket_tags_ClinicBranchId_Name",
                table: "bd_marketing_ticket_tags",
                columns: new[] { "ClinicBranchId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_tickets_AppointmentId",
                table: "bd_marketing_tickets",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_tickets_AssigneeId",
                table: "bd_marketing_tickets",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_tickets_ClinicBranchId_Code",
                table: "bd_marketing_tickets",
                columns: new[] { "ClinicBranchId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_tickets_ClinicBranchId_Phone",
                table: "bd_marketing_tickets",
                columns: new[] { "ClinicBranchId", "Phone" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_tickets_ClinicBranchId_ReceivedAt",
                table: "bd_marketing_tickets",
                columns: new[] { "ClinicBranchId", "ReceivedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_marketing_ticket_activities");

            migrationBuilder.DropTable(
                name: "bd_marketing_ticket_tags");

            migrationBuilder.DropTable(
                name: "bd_marketing_tickets");
        }
    }
}
