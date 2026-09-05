using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Hình ảnh bệnh nhân — the "Giai đoạn điều trị" tag (before/after) and the
    /// drag-to-sort position the reference keeps on each image
    /// (<c>type</c> and <c>ordering</c> in <c>GET /patient-images</c>).
    ///
    /// Existing rows become "Trước điều trị" and are numbered in the order they
    /// were taken, which is the order they were already shown in.
    ///
    /// Hand-written for the reason given in AddDepartmentSortOrder: the model
    /// snapshot has drifted for unrelated entities, so a scaffolded migration
    /// would sweep up changes that belong to other work.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260905100000_AddPatientImageTypeAndOrdering")]
    public partial class AddPatientImageTypeAndOrdering : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "Type",
                table: "bd_patient_images",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);

            migrationBuilder.AddColumn<int>(
                name: "Ordering",
                table: "bd_patient_images",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql("""
                UPDATE "bd_patient_images" AS img
                SET "Ordering" = numbered.position
                FROM (
                    SELECT "Id",
                           ROW_NUMBER() OVER (
                               PARTITION BY "PatientId", "ClinicBranchId"
                               ORDER BY "TakenAt", "CreationTime", "Id") AS position
                    FROM "bd_patient_images"
                ) AS numbered
                WHERE img."Id" = numbered."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_PatientId_Ordering",
                table: "bd_patient_images",
                columns: new[] { "PatientId", "Ordering" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_PatientId_Ordering",
                table: "bd_patient_images");

            migrationBuilder.DropColumn(
                name: "Ordering",
                table: "bd_patient_images");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "bd_patient_images");
        }
    }
}
