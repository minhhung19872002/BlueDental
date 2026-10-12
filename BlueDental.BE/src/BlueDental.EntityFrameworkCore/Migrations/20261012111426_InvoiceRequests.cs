using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class InvoiceRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_invoice_request_links",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientPaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    Token = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_invoice_request_links", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_invoice_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientPaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Source = table.Column<short>(type: "smallint", nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BirthYear = table.Column<int>(type: "integer", nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NationalId = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    PersonalAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CompanyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TaxCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CompanyAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    WantsPaperInvoice = table.Column<bool>(type: "boolean", nullable: true),
                    ServiceName = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RequestedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DueAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    AssigneeId = table.Column<Guid>(type: "uuid", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    InvoiceNo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_bd_invoice_requests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_invoice_request_links_PatientPaymentId",
                table: "bd_invoice_request_links",
                column: "PatientPaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_invoice_request_links_Token",
                table: "bd_invoice_request_links",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_invoice_requests_ClinicBranchId_Code",
                table: "bd_invoice_requests",
                columns: new[] { "ClinicBranchId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_invoice_requests_ClinicBranchId_Status",
                table: "bd_invoice_requests",
                columns: new[] { "ClinicBranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_invoice_requests_PatientId",
                table: "bd_invoice_requests",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_invoice_requests_PatientPaymentId",
                table: "bd_invoice_requests",
                column: "PatientPaymentId",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" <> 5");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_invoice_request_links");

            migrationBuilder.DropTable(
                name: "bd_invoice_requests");
        }
    }
}
