using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class StageBackfillAndChangeLogR1125 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsBackfill",
                table: "bd_treatment_stages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "bd_treatment_stage_change_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentStageId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<short>(type: "smallint", nullable: false),
                    Before = table.Column<string>(type: "text", nullable: true),
                    After = table.Column<string>(type: "text", nullable: true),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ActorUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_treatment_stage_change_logs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_treatment_stage_change_logs_PatientId_OccurredAt",
                table: "bd_treatment_stage_change_logs",
                columns: new[] { "PatientId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_treatment_stage_change_logs_TreatmentStageId_OccurredAt",
                table: "bd_treatment_stage_change_logs",
                columns: new[] { "TreatmentStageId", "OccurredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_treatment_stage_change_logs");

            migrationBuilder.DropColumn(
                name: "IsBackfill",
                table: "bd_treatment_stages");
        }
    }
}
