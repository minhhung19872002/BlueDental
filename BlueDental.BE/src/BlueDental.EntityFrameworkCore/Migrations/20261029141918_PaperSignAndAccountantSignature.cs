using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PaperSignAndAccountantSignature : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AccountantSignatureSavedAt",
                table: "bd_patient_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AccountantSignerId",
                table: "bd_patient_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PaperSignedAt",
                table: "bd_patient_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PaperSignedById",
                table: "bd_patient_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_accountant_signature_changes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<short>(type: "smallint", nullable: false),
                    ChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_accountant_signature_changes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_accountant_signatures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SignatureCipher = table.Column<string>(type: "text", nullable: false),
                    Source = table.Column<short>(type: "smallint", nullable: false),
                    SavedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_accountant_signatures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_payment_receipt_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientPaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<short>(type: "smallint", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    SignMode = table.Column<short>(type: "smallint", nullable: true),
                    AccountantSignerId = table.Column<Guid>(type: "uuid", nullable: true),
                    AccountantSignatureSavedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CustomerSignedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CustomerSignedOnPaper = table.Column<bool>(type: "boolean", nullable: true),
                    FileSha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CancelReasonCode = table.Column<short>(type: "smallint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_payment_receipt_logs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_accountant_signature_changes_UserId_ChangedAt",
                table: "bd_accountant_signature_changes",
                columns: new[] { "UserId", "ChangedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_accountant_signatures_UserId",
                table: "bd_accountant_signatures",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_payment_receipt_logs_PatientPaymentId_At",
                table: "bd_payment_receipt_logs",
                columns: new[] { "PatientPaymentId", "At" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_accountant_signature_changes");

            migrationBuilder.DropTable(
                name: "bd_accountant_signatures");

            migrationBuilder.DropTable(
                name: "bd_payment_receipt_logs");

            migrationBuilder.DropColumn(
                name: "AccountantSignatureSavedAt",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "AccountantSignerId",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "PaperSignedAt",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "PaperSignedById",
                table: "bd_patient_payments");
        }
    }
}
