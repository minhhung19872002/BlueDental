using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddClinicIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_clinic_connections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaseUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ApiKeyCipher = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    LastHandshakeTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    InvoiceSyncEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ServiceCatalogSyncEnabled = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_bd_clinic_connections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_integration_call_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Operation = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RequestPath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    StatusCode = table.Column<int>(type: "integer", nullable: true),
                    Succeeded = table.Column<bool>(type: "boolean", nullable: false),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false),
                    ItemCount = table.Column<int>(type: "integer", nullable: false),
                    Error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_integration_call_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_service_catalog_sync_states",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Fingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PartnerServiceId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    LastSyncedTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_service_catalog_sync_states", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_clinic_connections_ClinicBranchId",
                table: "bd_clinic_connections",
                column: "ClinicBranchId",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bd_integration_call_logs_ClinicBranchId_CreationTime",
                table: "bd_integration_call_logs",
                columns: new[] { "ClinicBranchId", "CreationTime" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_catalog_sync_states_CatalogEntryId",
                table: "bd_service_catalog_sync_states",
                column: "CatalogEntryId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_catalog_sync_states_ClinicBranchId",
                table: "bd_service_catalog_sync_states",
                column: "ClinicBranchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_clinic_connections");

            migrationBuilder.DropTable(
                name: "bd_integration_call_logs");

            migrationBuilder.DropTable(
                name: "bd_service_catalog_sync_states");
        }
    }
}
