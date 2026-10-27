using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ReceiptExportFile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReceiptFileName",
                table: "bd_patient_payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptFileSha256",
                table: "bd_patient_payments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "SignMode",
                table: "bd_patient_payments",
                type: "smallint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReceiptFileName",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "ReceiptFileSha256",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "SignMode",
                table: "bd_patient_payments");
        }
    }
}
