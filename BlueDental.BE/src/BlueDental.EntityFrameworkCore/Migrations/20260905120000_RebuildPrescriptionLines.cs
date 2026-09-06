using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Đơn thuốc rebuilt to match the reference "Thêm đơn thuốc" dialog.
    ///
    /// The slip loses its status (the reference has none — a slip is edited or
    /// deleted, never dispensed/cancelled) and its link to a diagnosis record
    /// (the dialog takes free text), and gains "Điều trị" (ngoại trú / nội trú).
    /// A line is now dosed like a template line — ngày uống × mỗi lần × số ngày
    /// with the "Sử dụng" flags — instead of free-text dosage/frequency.
    ///
    /// Existing lines keep their day count; the old total quantity is spread
    /// evenly over those days so the computed Số lượng stays the same.
    ///
    /// Hand-written: the model snapshot carries unrelated in-flight work.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260905120000_RebuildPrescriptionLines")]
    public partial class RebuildPrescriptionLines : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --- bd_prescriptions ------------------------------------------------
            migrationBuilder.DropIndex(
                name: "IX_bd_prescriptions_ClinicBranchId_Status",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "PatientDiagnosisId",
                table: "bd_prescriptions");

            migrationBuilder.AddColumn<short>(
                name: "TreatmentType",
                table: "bd_prescriptions",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescriptions_ClinicBranchId_IssuedAt",
                table: "bd_prescriptions",
                columns: new[] { "ClinicBranchId", "IssuedAt" });

            // --- bd_prescription_items -------------------------------------------
            migrationBuilder.DropIndex(
                name: "IX_bd_prescription_items_PrescriptionId",
                table: "bd_prescription_items");

            migrationBuilder.RenameColumn(
                name: "DurationDays",
                table: "bd_prescription_items",
                newName: "Days");

            migrationBuilder.AddColumn<int>(
                name: "TimesPerDay",
                table: "bd_prescription_items",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<decimal>(
                name: "AmountPerTime",
                table: "bd_prescription_items",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 1m);

            migrationBuilder.AddColumn<int>(
                name: "Usage",
                table: "bd_prescription_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "OtherUsage",
                table: "bd_prescription_items",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "bd_prescription_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                UPDATE "bd_prescription_items"
                SET "AmountPerTime" = CASE
                        WHEN "Days" > 0 AND "Quantity" > 0
                            THEN ROUND("Quantity"::numeric / "Days", 2)
                        ELSE 1
                    END,
                    "Days" = CASE WHEN "Days" > 0 THEN "Days" ELSE 1 END;
                """);

            migrationBuilder.Sql("""
                UPDATE "bd_prescription_items" AS i
                SET "SortOrder" = ranked.rn - 1
                FROM (
                    SELECT "Id",
                           ROW_NUMBER() OVER (PARTITION BY "PrescriptionId" ORDER BY "Id") AS rn
                    FROM "bd_prescription_items"
                ) AS ranked
                WHERE ranked."Id" = i."Id";
                """);

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "bd_prescription_items");

            migrationBuilder.DropColumn(
                name: "Dosage",
                table: "bd_prescription_items");

            migrationBuilder.DropColumn(
                name: "Frequency",
                table: "bd_prescription_items");

            migrationBuilder.DropColumn(
                name: "Instructions",
                table: "bd_prescription_items");

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescription_items_PrescriptionId_SortOrder",
                table: "bd_prescription_items",
                columns: new[] { "PrescriptionId", "SortOrder" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // --- bd_prescription_items -------------------------------------------
            migrationBuilder.DropIndex(
                name: "IX_bd_prescription_items_PrescriptionId_SortOrder",
                table: "bd_prescription_items");

            migrationBuilder.AddColumn<string>(
                name: "Dosage",
                table: "bd_prescription_items",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Frequency",
                table: "bd_prescription_items",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Instructions",
                table: "bd_prescription_items",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "bd_prescription_items",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql("""
                UPDATE "bd_prescription_items"
                SET "Quantity" = GREATEST(1, CEIL("TimesPerDay" * "AmountPerTime" * "Days"))::integer,
                    "Dosage" = "AmountPerTime"::text,
                    "Frequency" = "TimesPerDay"::text || ' lần/ngày',
                    "Instructions" = "OtherUsage";
                """);

            migrationBuilder.DropColumn(name: "TimesPerDay", table: "bd_prescription_items");
            migrationBuilder.DropColumn(name: "AmountPerTime", table: "bd_prescription_items");
            migrationBuilder.DropColumn(name: "Usage", table: "bd_prescription_items");
            migrationBuilder.DropColumn(name: "OtherUsage", table: "bd_prescription_items");
            migrationBuilder.DropColumn(name: "SortOrder", table: "bd_prescription_items");

            migrationBuilder.RenameColumn(
                name: "Days",
                table: "bd_prescription_items",
                newName: "DurationDays");

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescription_items_PrescriptionId",
                table: "bd_prescription_items",
                column: "PrescriptionId");

            // --- bd_prescriptions ------------------------------------------------
            migrationBuilder.DropIndex(
                name: "IX_bd_prescriptions_ClinicBranchId_IssuedAt",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "TreatmentType",
                table: "bd_prescriptions");

            migrationBuilder.AddColumn<System.Guid>(
                name: "PatientDiagnosisId",
                table: "bd_prescriptions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Status",
                table: "bd_prescriptions",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescriptions_ClinicBranchId_Status",
                table: "bd_prescriptions",
                columns: new[] { "ClinicBranchId", "Status" });
        }
    }
}
