using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// P2610 (R-1044): "Đã xuất phiếu thu" and "Phiếu bị hủy" join the two old
    /// statuses. A receipt cancelled before this was only soft-deleted with its
    /// reason; it becomes "Phiếu bị hủy" with the soft delete's who and when. A
    /// receipt soft-deleted with its slip carries no reason and is left alone.
    /// </summary>
    public partial class PaymentReceiptStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "CancelReasonCode",
                table: "bd_patient_payments",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CancelledAt",
                table: "bd_patient_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CancelledById",
                table: "bd_patient_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IssuedAt",
                table: "bd_patient_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IssuedById",
                table: "bd_patient_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE bd_patient_payments
                SET "Status" = 4,
                    "CancelledAt" = "DeletionTime",
                    "CancelledById" = "DeleterId"
                WHERE "IsDeleted" AND "CancelReason" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Back to the two old statuses: a cancelled receipt stays soft-deleted,
            // an exported one is unpaid again.
            migrationBuilder.Sql(
                """
                UPDATE bd_patient_payments SET "Status" = 1 WHERE "Status" IN (3, 4);
                """);

            migrationBuilder.DropColumn(
                name: "CancelReasonCode",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "CancelledById",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "IssuedAt",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "IssuedById",
                table: "bd_patient_payments");
        }
    }
}
