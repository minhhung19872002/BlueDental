using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ServiceWarrantyCardP3110 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ServiceWarrantyCardId",
                table: "bd_patient_images",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_service_warranty_cards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothNumber = table.Column<int>(type: "integer", nullable: true),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    DurationMonths = table.Column<int>(type: "integer", nullable: true),
                    DurationDays = table.Column<int>(type: "integer", nullable: true),
                    Conditions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ActivatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ActivatedById = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_bd_service_warranty_cards", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_ServiceWarrantyCardId",
                table: "bd_patient_images",
                column: "ServiceWarrantyCardId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_warranty_cards_Code",
                table: "bd_service_warranty_cards",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_warranty_cards_TreatmentPlanId",
                table: "bd_service_warranty_cards",
                column: "TreatmentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_warranty_cards_TreatmentServiceId_ToothNumber",
                table: "bd_service_warranty_cards",
                columns: new[] { "TreatmentServiceId", "ToothNumber" },
                unique: true,
                filter: "\"IsDeleted\" = false")
                .Annotation("Npgsql:NullsDistinct", false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_service_warranty_cards");

            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_ServiceWarrantyCardId",
                table: "bd_patient_images");

            migrationBuilder.DropColumn(
                name: "ServiceWarrantyCardId",
                table: "bd_patient_images");
        }
    }
}
