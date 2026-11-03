using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class WarrantyCardNumberR1090 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_service_warranty_cards_Code",
                table: "bd_service_warranty_cards");

            migrationBuilder.CreateTable(
                name: "bd_warranty_card_sequences",
                columns: table => new
                {
                    TreatmentServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    LastNo = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_warranty_card_sequences", x => new { x.TreatmentServiceId, x.StartDate });
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_warranty_cards_TreatmentServiceId_Code",
                table: "bd_service_warranty_cards",
                columns: new[] { "TreatmentServiceId", "Code" },
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_warranty_card_sequences");

            migrationBuilder.DropIndex(
                name: "IX_bd_service_warranty_cards_TreatmentServiceId_Code",
                table: "bd_service_warranty_cards");

            migrationBuilder.CreateIndex(
                name: "IX_bd_service_warranty_cards_Code",
                table: "bd_service_warranty_cards",
                column: "Code");
        }
    }
}
