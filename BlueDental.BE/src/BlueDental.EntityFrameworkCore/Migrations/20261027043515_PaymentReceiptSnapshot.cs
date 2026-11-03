using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// P2610 phase 3: the PHIẾU THU content frozen when a payment is written.
    /// Older receipts keep null and are read from today's data.
    /// </summary>
    public partial class PaymentReceiptSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReceiptSnapshot",
                table: "bd_patient_payments",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReceiptSnapshot",
                table: "bd_patient_payments");
        }
    }
}
