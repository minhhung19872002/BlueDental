using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class EInvoiceBranchConfigs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "PatientPaymentId",
                table: "bd_electronic_invoices",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<DateTime>(
                name: "ArisingDate",
                table: "bd_electronic_invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "bd_electronic_invoices",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ProviderConfigId",
                table: "bd_electronic_invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_einvoice_provider_configs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BaseUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PasswordCipher = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    TaxCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Pattern = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Serial = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    VatRate = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_einvoice_provider_configs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_electronic_invoices_TreatmentPlanId",
                table: "bd_electronic_invoices",
                column: "TreatmentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_einvoice_provider_configs_ClinicBranchId",
                table: "bd_einvoice_provider_configs",
                column: "ClinicBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_einvoice_provider_configs_ClinicBranchId_Active",
                table: "bd_einvoice_provider_configs",
                column: "ClinicBranchId",
                unique: true,
                filter: "\"IsActive\" = true AND \"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_einvoice_provider_configs");

            migrationBuilder.DropIndex(
                name: "IX_bd_electronic_invoices_TreatmentPlanId",
                table: "bd_electronic_invoices");

            migrationBuilder.DropColumn(
                name: "ArisingDate",
                table: "bd_electronic_invoices");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "bd_electronic_invoices");

            migrationBuilder.DropColumn(
                name: "ProviderConfigId",
                table: "bd_electronic_invoices");

            migrationBuilder.AlterColumn<Guid>(
                name: "PatientPaymentId",
                table: "bd_electronic_invoices",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
