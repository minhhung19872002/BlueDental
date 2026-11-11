using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class XrayAgentF95 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "StaffId",
                table: "bd_patient_images",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "XrayDeviceId",
                table: "bd_patient_images",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_xray_devices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_xray_devices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_xray_inbox_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    XrayDeviceId = table.Column<Guid>(type: "uuid", nullable: false),
                    BlobName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FileName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    HintCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    HintName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    HintBirthYear = table.Column<int>(type: "integer", nullable: true),
                    CapturedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    PatientImageId = table.Column<Guid>(type: "uuid", nullable: true),
                    HandledBy = table.Column<Guid>(type: "uuid", nullable: true),
                    HandledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_xray_inbox_items", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_XrayDeviceId",
                table: "bd_patient_images",
                column: "XrayDeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_xray_devices_ClinicBranchId",
                table: "bd_xray_devices",
                column: "ClinicBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_xray_devices_TokenHash",
                table: "bd_xray_devices",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_xray_inbox_items_ClinicBranchId_Status_ReceivedAt",
                table: "bd_xray_inbox_items",
                columns: new[] { "ClinicBranchId", "Status", "ReceivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_xray_inbox_items_XrayDeviceId_Sha256",
                table: "bd_xray_inbox_items",
                columns: new[] { "XrayDeviceId", "Sha256" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_xray_devices");

            migrationBuilder.DropTable(
                name: "bd_xray_inbox_items");

            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_XrayDeviceId",
                table: "bd_patient_images");

            migrationBuilder.DropColumn(
                name: "XrayDeviceId",
                table: "bd_patient_images");

            migrationBuilder.AlterColumn<Guid>(
                name: "StaffId",
                table: "bd_patient_images",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
