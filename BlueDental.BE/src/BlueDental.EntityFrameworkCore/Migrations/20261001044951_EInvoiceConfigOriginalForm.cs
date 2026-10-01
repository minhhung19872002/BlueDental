using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class EInvoiceConfigOriginalForm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BaseUrl",
                table: "bd_einvoice_provider_configs");

            migrationBuilder.DropColumn(
                name: "Pattern",
                table: "bd_einvoice_provider_configs");

            migrationBuilder.DropColumn(
                name: "VatRate",
                table: "bd_einvoice_provider_configs");

            migrationBuilder.RenameColumn(
                name: "Serial",
                table: "bd_einvoice_provider_configs",
                newName: "LastSerial");

            migrationBuilder.AddColumn<string>(
                name: "AppId",
                table: "bd_einvoice_provider_configs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastPattern",
                table: "bd_einvoice_provider_configs",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TaxByPeriod",
                table: "bd_einvoice_provider_configs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "TaxByService",
                table: "bd_einvoice_provider_configs",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AppId",
                table: "bd_einvoice_provider_configs");

            migrationBuilder.DropColumn(
                name: "LastPattern",
                table: "bd_einvoice_provider_configs");

            migrationBuilder.DropColumn(
                name: "TaxByPeriod",
                table: "bd_einvoice_provider_configs");

            migrationBuilder.DropColumn(
                name: "TaxByService",
                table: "bd_einvoice_provider_configs");

            migrationBuilder.RenameColumn(
                name: "LastSerial",
                table: "bd_einvoice_provider_configs",
                newName: "Serial");

            migrationBuilder.AddColumn<string>(
                name: "BaseUrl",
                table: "bd_einvoice_provider_configs",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Pattern",
                table: "bd_einvoice_provider_configs",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "VatRate",
                table: "bd_einvoice_provider_configs",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
