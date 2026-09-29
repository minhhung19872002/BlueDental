using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddElectronicInvoices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_electronic_invoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientPaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    Provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Ikey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Pattern = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Serial = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    ProviderStatus = table.Column<int>(type: "integer", nullable: true),
                    No = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    LookupCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    LinkView = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LastSyncedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
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
                    table.PrimaryKey("PK_bd_electronic_invoices", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_electronic_invoices_ClinicBranchId",
                table: "bd_electronic_invoices",
                column: "ClinicBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_electronic_invoices_Ikey",
                table: "bd_electronic_invoices",
                column: "Ikey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_electronic_invoices_PatientId",
                table: "bd_electronic_invoices",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_electronic_invoices_PatientPaymentId",
                table: "bd_electronic_invoices",
                column: "PatientPaymentId",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_electronic_invoices");
        }
    }
}
