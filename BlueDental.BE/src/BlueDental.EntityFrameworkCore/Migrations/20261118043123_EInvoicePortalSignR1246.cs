using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class EInvoicePortalSignR1246 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Attempts",
                table: "bd_electronic_invoices",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FormJson",
                table: "bd_electronic_invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Round",
                table: "bd_electronic_invoices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SignedAt",
                table: "bd_electronic_invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceKey",
                table: "bd_electronic_invoices",
                type: "character varying(90)",
                maxLength: 90,
                nullable: false,
                defaultValue: "");

            // Each invoice so far was one round, sent under the source's own key.
            // Signed ones (1 Published, 3 Replaced, 4 Adjusted) count as signed when
            // last read; a cancelled one (2) as cancelled then.
            migrationBuilder.Sql("""
                UPDATE bd_electronic_invoices SET
                    "SourceKey" = "Ikey",
                    "Round" = 1,
                    "SignedAt" = CASE WHEN "Status" IN (1, 3, 4) THEN COALESCE("LastSyncedAt", "CreationTime") END,
                    "Attempts" = jsonb_build_array(jsonb_build_object(
                        'Round', 1,
                        'Ikey', "Ikey",
                        'Pattern', "Pattern",
                        'Serial', "Serial",
                        'Status', "Status",
                        'No', "No",
                        'Amount', "Amount",
                        'SentAt', to_jsonb("CreationTime"),
                        'SignedAt', CASE WHEN "Status" IN (1, 3, 4) THEN to_jsonb(COALESCE("LastSyncedAt", "CreationTime")) ELSE 'null'::jsonb END,
                        'CancelledAt', CASE WHEN "Status" = 2 THEN to_jsonb(COALESCE("LastSyncedAt", "CreationTime")) ELSE 'null'::jsonb END,
                        'PdfBlobName', NULL));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_bd_electronic_invoices_SourceKey",
                table: "bd_electronic_invoices",
                column: "SourceKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_electronic_invoices_Status_SignedAt",
                table: "bd_electronic_invoices",
                columns: new[] { "Status", "SignedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_electronic_invoices_SourceKey",
                table: "bd_electronic_invoices");

            migrationBuilder.DropIndex(
                name: "IX_bd_electronic_invoices_Status_SignedAt",
                table: "bd_electronic_invoices");

            migrationBuilder.DropColumn(
                name: "Attempts",
                table: "bd_electronic_invoices");

            migrationBuilder.DropColumn(
                name: "FormJson",
                table: "bd_electronic_invoices");

            migrationBuilder.DropColumn(
                name: "Round",
                table: "bd_electronic_invoices");

            migrationBuilder.DropColumn(
                name: "SignedAt",
                table: "bd_electronic_invoices");

            migrationBuilder.DropColumn(
                name: "SourceKey",
                table: "bd_electronic_invoices");
        }
    }
}
