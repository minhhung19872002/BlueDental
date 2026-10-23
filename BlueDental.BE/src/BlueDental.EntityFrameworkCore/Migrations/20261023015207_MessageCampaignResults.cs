using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class MessageCampaignResults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "MergedIntoMessageId",
                table: "bd_message_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "SkipReason",
                table: "bd_message_logs",
                type: "smallint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_message_send_batches_ClinicBranchId_CreationTime",
                table: "bd_message_send_batches",
                columns: new[] { "ClinicBranchId", "CreationTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_message_send_batches_ClinicBranchId_CreationTime",
                table: "bd_message_send_batches");

            migrationBuilder.DropColumn(
                name: "MergedIntoMessageId",
                table: "bd_message_logs");

            migrationBuilder.DropColumn(
                name: "SkipReason",
                table: "bd_message_logs");
        }
    }
}
