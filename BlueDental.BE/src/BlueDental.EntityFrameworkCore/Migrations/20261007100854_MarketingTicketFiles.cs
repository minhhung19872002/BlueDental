using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class MarketingTicketFiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ImportFileId",
                table: "bd_marketing_tickets",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_marketing_ticket_import_files",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    RowCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedCount = table.Column<int>(type: "integer", nullable: false),
                    ReoccurredCount = table.Column<int>(type: "integer", nullable: false),
                    SourceTaxonomyId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    TagIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    AssigneeIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_marketing_ticket_import_files", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_tickets_ImportFileId",
                table: "bd_marketing_tickets",
                column: "ImportFileId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_marketing_ticket_import_files_ClinicBranchId_CreationTime",
                table: "bd_marketing_ticket_import_files",
                columns: new[] { "ClinicBranchId", "CreationTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_marketing_ticket_import_files");

            migrationBuilder.DropIndex(
                name: "IX_bd_marketing_tickets_ImportFileId",
                table: "bd_marketing_tickets");

            migrationBuilder.DropColumn(
                name: "ImportFileId",
                table: "bd_marketing_tickets");
        }
    }
}
