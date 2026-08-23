using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddTreatmentServiceAndPatientPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "bd_treatment_plans",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ConsultantStaffId",
                table: "bd_treatment_plans",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "DiscountType",
                table: "bd_treatment_plans",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountValue",
                table: "bd_treatment_plans",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VoucherDiscountAmount",
                table: "bd_treatment_plans",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_patient_payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    TreatmentServiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Kind = table.Column<short>(type: "smallint", nullable: false),
                    Method = table.Column<short>(type: "smallint", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PaidAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
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
                    table.PrimaryKey("PK_bd_patient_payments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_treatment_services",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceAdviseId = table.Column<Guid>(type: "uuid", nullable: true),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    DiscountType = table.Column<short>(type: "smallint", nullable: false),
                    DiscountValue = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Teeth = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_treatment_services", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_treatment_services_bd_treatment_plans_TreatmentPlanId",
                        column: x => x.TreatmentPlanId,
                        principalTable: "bd_treatment_plans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_payments_ClinicBranchId_PaidAt",
                table: "bd_patient_payments",
                columns: new[] { "ClinicBranchId", "PaidAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_payments_PatientId_PaidAt",
                table: "bd_patient_payments",
                columns: new[] { "PatientId", "PaidAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_payments_TreatmentPlanId",
                table: "bd_patient_payments",
                column: "TreatmentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_treatment_services_PatientId_Status",
                table: "bd_treatment_services",
                columns: new[] { "PatientId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_treatment_services_SourceAdviseId",
                table: "bd_treatment_services",
                column: "SourceAdviseId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_treatment_services_TreatmentPlanId_Code",
                table: "bd_treatment_services",
                columns: new[] { "TreatmentPlanId", "Code" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_patient_payments");

            migrationBuilder.DropTable(
                name: "bd_treatment_services");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "bd_treatment_plans");

            migrationBuilder.DropColumn(
                name: "ConsultantStaffId",
                table: "bd_treatment_plans");

            migrationBuilder.DropColumn(
                name: "DiscountType",
                table: "bd_treatment_plans");

            migrationBuilder.DropColumn(
                name: "DiscountValue",
                table: "bd_treatment_plans");

            migrationBuilder.DropColumn(
                name: "VoucherDiscountAmount",
                table: "bd_treatment_plans");
        }
    }
}
