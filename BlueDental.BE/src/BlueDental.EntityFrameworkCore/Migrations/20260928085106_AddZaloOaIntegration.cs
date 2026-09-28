using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddZaloOaIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Cost",
                table: "bd_message_logs",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalMessageId",
                table: "bd_message_logs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalTemplateId",
                table: "bd_message_logs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_zalo_oa_connections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    OaId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    OaName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AvatarUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PackageName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AccessTokenCipher = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    RefreshTokenCipher = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    AccessTokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RefreshTokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConnectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastRefreshedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_bd_zalo_oa_connections", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_message_logs_ExternalMessageId",
                table: "bd_message_logs",
                column: "ExternalMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_zalo_oa_connections_ClinicBranchId",
                table: "bd_zalo_oa_connections",
                column: "ClinicBranchId",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_zalo_oa_connections");

            migrationBuilder.DropIndex(
                name: "IX_bd_message_logs_ExternalMessageId",
                table: "bd_message_logs");

            migrationBuilder.DropColumn(
                name: "Cost",
                table: "bd_message_logs");

            migrationBuilder.DropColumn(
                name: "ExternalMessageId",
                table: "bd_message_logs");

            migrationBuilder.DropColumn(
                name: "ExternalTemplateId",
                table: "bd_message_logs");
        }
    }
}
