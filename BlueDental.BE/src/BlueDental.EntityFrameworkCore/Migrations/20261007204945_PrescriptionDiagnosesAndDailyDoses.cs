using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// F-58: a prescription picks its diagnoses from the patient's phiếu điều trị
    /// (bd_prescription_diagnoses + DiagnosisNote) and doses each medicine by
    /// session (sáng / trưa / chiều / tối) instead of "ngày uống × mỗi lần".
    /// Old lines are spread over the sessions so every quantity stays the same:
    /// 1 lần → sáng; 2 → sáng, tối; 3 → sáng, trưa, tối; 4 → cả bốn; beyond 4 the
    /// extra doses go to sáng.
    /// </summary>
    public partial class PrescriptionDiagnosesAndDailyDoses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "DiagnosisText",
                table: "bd_prescriptions",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiagnosisNote",
                table: "bd_prescriptions",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            foreach (var session in new[] { "Morning", "Noon", "Afternoon", "Evening" })
            {
                migrationBuilder.AddColumn<decimal>(
                    name: session,
                    table: "bd_prescription_items",
                    type: "numeric(18,2)",
                    nullable: false,
                    defaultValue: 0m);
            }

            migrationBuilder.Sql("""
                UPDATE bd_prescription_items
                SET "Morning" = CASE WHEN "TimesPerDay" >= 1
                                     THEN "AmountPerTime" * (1 + GREATEST("TimesPerDay" - 4, 0))
                                     ELSE 0 END,
                    "Noon" = CASE WHEN "TimesPerDay" >= 3 THEN "AmountPerTime" ELSE 0 END,
                    "Afternoon" = CASE WHEN "TimesPerDay" >= 4 THEN "AmountPerTime" ELSE 0 END,
                    "Evening" = CASE WHEN "TimesPerDay" >= 2 THEN "AmountPerTime" ELSE 0 END;
                """);

            migrationBuilder.DropColumn(name: "TimesPerDay", table: "bd_prescription_items");
            migrationBuilder.DropColumn(name: "AmountPerTime", table: "bd_prescription_items");

            migrationBuilder.CreateTable(
                name: "bd_prescription_diagnoses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PrescriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    DiagnosisId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DiagnosisName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ToothCodes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_prescription_diagnoses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_prescription_diagnoses_bd_prescriptions_PrescriptionId",
                        column: x => x.PrescriptionId,
                        principalTable: "bd_prescriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescription_diagnoses_PrescriptionId_SortOrder",
                table: "bd_prescription_diagnoses",
                columns: new[] { "PrescriptionId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescription_diagnoses_TreatmentPlanId",
                table: "bd_prescription_diagnoses",
                column: "TreatmentPlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "bd_prescription_diagnoses");

            migrationBuilder.AddColumn<int>(
                name: "TimesPerDay",
                table: "bd_prescription_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "AmountPerTime",
                table: "bd_prescription_items",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            // Folds the sessions back: times = sessions in use, amount = their average.
            migrationBuilder.Sql("""
                UPDATE bd_prescription_items
                SET "TimesPerDay" = GREATEST(1,
                        ("Morning" > 0)::int + ("Noon" > 0)::int
                        + ("Afternoon" > 0)::int + ("Evening" > 0)::int),
                    "AmountPerTime" = ROUND(("Morning" + "Noon" + "Afternoon" + "Evening")
                        / GREATEST(1,
                            ("Morning" > 0)::int + ("Noon" > 0)::int
                            + ("Afternoon" > 0)::int + ("Evening" > 0)::int), 2);
                """);

            foreach (var session in new[] { "Morning", "Noon", "Afternoon", "Evening" })
            {
                migrationBuilder.DropColumn(name: session, table: "bd_prescription_items");
            }

            migrationBuilder.DropColumn(name: "DiagnosisNote", table: "bd_prescriptions");

            migrationBuilder.Sql("""
                UPDATE bd_prescriptions SET "DiagnosisText" = LEFT("DiagnosisText", 500)
                WHERE length("DiagnosisText") > 500;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "DiagnosisText",
                table: "bd_prescriptions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(2000)",
                oldMaxLength: 2000,
                oldNullable: true);
        }
    }
}
