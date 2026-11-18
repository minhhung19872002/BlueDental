using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class InvoiceRequestFlowR1248 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_invoice_requests_PatientPaymentId",
                table: "bd_invoice_requests");

            // P1811: the status follows EasyInvoice. Staff's old Đã hủy (5) is now
            // Đã hủy yêu cầu (6); 5 means cancelled on the portal. Cần bổ sung (3)
            // is gone, and an old Đang xử lý (2) that never reached EasyInvoice
            // waits for Xử lý again: both are Mới (1).
            migrationBuilder.Sql("""
                UPDATE bd_invoice_requests SET "Status" = 6 WHERE "Status" = 5;
                UPDATE bd_invoice_requests SET "Status" = 1 WHERE "Status" = 3;
                UPDATE bd_invoice_requests r SET "Status" = 1
                WHERE r."Status" = 2
                  AND NOT EXISTS (
                      SELECT 1 FROM bd_electronic_invoices e
                      WHERE e."IsDeleted" = false
                        AND e."Status" = 0
                        AND (e."PatientPaymentId" = r."PatientPaymentId"
                             OR (e."TreatmentPlanId" IS NOT NULL AND e."TreatmentPlanId" = r."TreatmentPlanId")));
                """);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ProcessedAt",
                table: "bd_invoice_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_invoice_requests_PatientPaymentId",
                table: "bd_invoice_requests",
                column: "PatientPaymentId",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" <> 6");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_invoice_requests_PatientPaymentId",
                table: "bd_invoice_requests");

            // Back to the old flow: cancelled on the portal reopened the request.
            migrationBuilder.Sql("""
                UPDATE bd_invoice_requests SET "Status" = 2 WHERE "Status" = 5;
                UPDATE bd_invoice_requests SET "Status" = 5 WHERE "Status" = 6;
                """);

            migrationBuilder.DropColumn(
                name: "ProcessedAt",
                table: "bd_invoice_requests");

            migrationBuilder.CreateIndex(
                name: "IX_bd_invoice_requests_PatientPaymentId",
                table: "bd_invoice_requests",
                column: "PatientPaymentId",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" <> 5");
        }
    }
}
