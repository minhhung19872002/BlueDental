using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PaymentRedInvoiceRequested : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RedInvoiceRequested",
                table: "bd_patient_payments",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RedInvoiceRequested",
                table: "bd_patient_payments");
        }
    }
}
