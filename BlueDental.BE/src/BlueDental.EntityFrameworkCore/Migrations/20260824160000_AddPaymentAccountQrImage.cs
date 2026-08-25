using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Danh mục / Phương thức thanh toán — "Tải ảnh QR".
    ///
    /// Both dialogs on the reference offer a QR upload, so an account keeps a
    /// pointer to one image. Only the pointer is stored: the bytes go to object
    /// storage, the same rule patient images follow.
    ///
    /// Hand-written for the reason given in
    /// <c>ScopeTagsAndPaymentAccountsToBranch</c> — the model snapshot in this
    /// repository has drifted for unrelated entities, so a scaffolded migration
    /// would carry their phantom differences along.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260824160000_AddPaymentAccountQrImage")]
    public partial class AddPaymentAccountQrImage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "QrImageBlobName",
                table: "bd_payment_accounts",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QrImageFileName",
                table: "bd_payment_accounts",
                type: "character varying(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QrImageContentType",
                table: "bd_payment_accounts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "QrImageSizeBytes",
                table: "bd_payment_accounts",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "QrImageSizeBytes", table: "bd_payment_accounts");
            migrationBuilder.DropColumn(name: "QrImageContentType", table: "bd_payment_accounts");
            migrationBuilder.DropColumn(name: "QrImageFileName", table: "bd_payment_accounts");
            migrationBuilder.DropColumn(name: "QrImageBlobName", table: "bd_payment_accounts");
        }
    }
}
