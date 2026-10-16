using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class CatalogRestorations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_catalog_restorations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Brand = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Origin = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Warranty = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_catalog_restorations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_catalog_restorations_bd_catalog_entries_CatalogEntryId",
                        column: x => x.CatalogEntryId,
                        principalTable: "bd_catalog_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_catalog_restorations_CatalogEntryId",
                table: "bd_catalog_restorations",
                column: "CatalogEntryId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_catalog_restorations");
        }
    }
}
