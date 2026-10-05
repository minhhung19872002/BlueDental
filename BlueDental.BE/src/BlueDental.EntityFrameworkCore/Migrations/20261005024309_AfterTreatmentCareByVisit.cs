using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AfterTreatmentCareByVisit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "TreatmentDate",
                table: "bd_care_records",
                type: "date",
                nullable: true);

            // Sau điều trị (Type 1) is now windowed by treatment day; rows written
            // before that take the clinic day they were opened on, or they would
            // drop out of every date filter.
            migrationBuilder.Sql(
                """
                UPDATE bd_care_records
                SET "TreatmentDate" = ("CreationTime" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                WHERE "Type" = 1 AND "TreatmentDate" IS NULL;
                """);

            migrationBuilder.CreateTable(
                name: "bd_care_contact_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CareRecordId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_care_contact_logs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_care_records_BranchId_Type_TreatmentDate_PatientId",
                table: "bd_care_records",
                columns: new[] { "BranchId", "Type", "TreatmentDate", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_care_contact_logs_CareRecordId_CreationTime",
                table: "bd_care_contact_logs",
                columns: new[] { "CareRecordId", "CreationTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_care_contact_logs");

            migrationBuilder.DropIndex(
                name: "IX_bd_care_records_BranchId_Type_TreatmentDate_PatientId",
                table: "bd_care_records");

            migrationBuilder.DropColumn(
                name: "TreatmentDate",
                table: "bd_care_records");
        }
    }
}
