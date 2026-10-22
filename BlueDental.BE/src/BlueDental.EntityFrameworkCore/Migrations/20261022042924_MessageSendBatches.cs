using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class MessageSendBatches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CareRecordId",
                table: "bd_message_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SendBatchId",
                table: "bd_message_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_message_send_batches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Channel = table.Column<short>(type: "smallint", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Source = table.Column<short>(type: "smallint", nullable: false),
                    CareType = table.Column<short>(type: "smallint", nullable: true),
                    FromDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ToDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SkipRecentDuplicates = table.Column<bool>(type: "boolean", nullable: false),
                    ScheduledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    RecipientCount = table.Column<int>(type: "integer", nullable: false),
                    SkippedCount = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_message_send_batches", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_message_logs_ClinicBranchId_TemplateId_PatientId_SentAt",
                table: "bd_message_logs",
                columns: new[] { "ClinicBranchId", "TemplateId", "PatientId", "SentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_message_logs_SendBatchId",
                table: "bd_message_logs",
                column: "SendBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_message_send_batches_ClinicBranchId_Status_ScheduledAt",
                table: "bd_message_send_batches",
                columns: new[] { "ClinicBranchId", "Status", "ScheduledAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_message_send_batches");

            migrationBuilder.DropIndex(
                name: "IX_bd_message_logs_ClinicBranchId_TemplateId_PatientId_SentAt",
                table: "bd_message_logs");

            migrationBuilder.DropIndex(
                name: "IX_bd_message_logs_SendBatchId",
                table: "bd_message_logs");

            migrationBuilder.DropColumn(
                name: "CareRecordId",
                table: "bd_message_logs");

            migrationBuilder.DropColumn(
                name: "SendBatchId",
                table: "bd_message_logs");
        }
    }
}
