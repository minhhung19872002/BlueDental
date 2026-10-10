using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddOrgChart : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_org_unit_change_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OrgUnitKind = table.Column<short>(type: "smallint", nullable: false),
                    Action = table.Column<short>(type: "smallint", nullable: false),
                    ChangesJson = table.Column<string>(type: "text", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_org_unit_change_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_org_units",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<short>(type: "smallint", nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    HeadStaffId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_bd_org_units", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_org_units_bd_org_units_ParentId",
                        column: x => x.ParentId,
                        principalTable: "bd_org_units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "bd_org_unit_members",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_org_unit_members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_org_unit_members_bd_org_units_OrgUnitId",
                        column: x => x.OrgUnitId,
                        principalTable: "bd_org_units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_org_unit_change_logs_OccurredAt",
                table: "bd_org_unit_change_logs",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_bd_org_unit_change_logs_OrgUnitId",
                table: "bd_org_unit_change_logs",
                column: "OrgUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_org_unit_members_OrgUnitId",
                table: "bd_org_unit_members",
                column: "OrgUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_org_unit_members_StaffId",
                table: "bd_org_unit_members",
                column: "StaffId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_org_units_Code",
                table: "bd_org_units",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bd_org_units_HeadStaffId",
                table: "bd_org_units",
                column: "HeadStaffId",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bd_org_units_ParentId",
                table: "bd_org_units",
                column: "ParentId");

            // Tổng giám đốc: the first branch, never deleted (F-67). Same id as OrgUnit.RootId.
            migrationBuilder.Sql("""
                INSERT INTO bd_org_units ("Id", "Code", "Name", "Kind", "ExtraProperties", "ConcurrencyStamp", "CreationTime", "IsDeleted")
                VALUES ('0f9a0000-0000-4000-8000-000000000001', 'BD', 'BlueDental', 1, '{}', replace(gen_random_uuid()::text, '-', ''), now() at time zone 'utc', false)
                ON CONFLICT ("Id") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_org_unit_change_logs");

            migrationBuilder.DropTable(
                name: "bd_org_unit_members");

            migrationBuilder.DropTable(
                name: "bd_org_units");
        }
    }
}
