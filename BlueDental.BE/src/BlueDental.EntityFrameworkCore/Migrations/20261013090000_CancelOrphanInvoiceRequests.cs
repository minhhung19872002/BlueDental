using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// R-915: "Hủy phiếu" left the receipt's open "Yêu cầu xuất HĐ" behind, so
    /// its detail showed "Không có thực thể nào PatientPayment" on Sao chép link
    /// QR. Cancelling a receipt now cancels its open requests; this does the same
    /// for the ones cancelled before, with the reason the app writes (in the
    /// clinic's language). Issued requests stay as history.
    ///
    /// Data only: the model is unchanged, so the snapshot is left as it is.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20261013090000_CancelOrphanInvoiceRequests")]
    public partial class CancelOrphanInvoiceRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE bd_invoice_requests r
                SET "Status" = 5,
                    "Reason" = left('Phiếu thu đã bị hủy: ' || coalesce(p."CancelReason", ''), 500),
                    "LastModificationTime" = now(),
                    "ConcurrencyStamp" = replace(gen_random_uuid()::text, '-', '')
                FROM bd_patient_payments p
                WHERE p."Id" = r."PatientPaymentId"
                  AND p."IsDeleted" = true
                  AND r."IsDeleted" = false
                  AND r."Status" IN (1, 2, 3);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Which status each request had is not kept, and its receipt is gone anyway.
        }
    }
}
