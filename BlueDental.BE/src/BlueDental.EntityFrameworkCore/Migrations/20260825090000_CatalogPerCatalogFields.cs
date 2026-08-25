using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Danh mục — the fields each catalog actually carries.
    ///
    /// The reference gives every catalog its own dialog rather than one shared
    /// form: a service has price, tax, stages and a warranty; a medicine has an
    /// active ingredient and two prices; a prescription template is a list of
    /// medicine lines. The shared entry table keeps the spine (name, group,
    /// code, order) and everything catalog-specific moves to its own table.
    ///
    /// Hand-written for the reason given in ScopeTagsAndPaymentAccountsToBranch:
    /// the model snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260825090000_CatalogPerCatalogFields")]
    public partial class CatalogPerCatalogFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DetailName",
                table: "bd_catalog_entries",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "bd_catalog_entries",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                table: "bd_catalog_entries",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            // A rich-text body, and the A4 medical-record form, outgrow any
            // varchar worth naming.
            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "bd_catalog_entries",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(8000)",
                oldMaxLength: 8000,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "bd_catalog_service_configs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    TaxRate = table.Column<short>(type: "smallint", nullable: false),
                    PriceIncludesTax = table.Column<bool>(type: "boolean", nullable: false),
                    DiscountIsPercent = table.Column<bool>(type: "boolean", nullable: false),
                    DiscountValue = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    RequireImage = table.Column<bool>(type: "boolean", nullable: false),
                    DeductDoctorOnWarranty = table.Column<bool>(type: "boolean", nullable: false),
                    SeparateRevenue = table.Column<bool>(type: "boolean", nullable: false),
                    ShowToothOnInvoice = table.Column<bool>(type: "boolean", nullable: false),
                    RevenueByStage = table.Column<bool>(type: "boolean", nullable: false),
                    RequireStageSequence = table.Column<bool>(type: "boolean", nullable: false),
                    WarrantyDays = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_catalog_service_configs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_catalog_service_configs_bd_catalog_entries_CatalogEntryId",
                        column: x => x.CatalogEntryId,
                        principalTable: "bd_catalog_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bd_catalog_service_stages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_catalog_service_stages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_catalog_service_stages_bd_catalog_entries_CatalogEntryId",
                        column: x => x.CatalogEntryId,
                        principalTable: "bd_catalog_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bd_catalog_medicines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActiveIngredient = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Usage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PurchasePrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PrescriptionCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    UsageNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_catalog_medicines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_catalog_medicines_bd_catalog_entries_CatalogEntryId",
                        column: x => x.CatalogEntryId,
                        principalTable: "bd_catalog_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bd_prescription_template_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicineEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    TimesPerDay = table.Column<int>(type: "integer", nullable: false),
                    AmountPerTime = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Days = table.Column<int>(type: "integer", nullable: false),
                    Usage = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_prescription_template_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_prescription_template_lines_bd_catalog_entries_CatalogEnt",
                        column: x => x.CatalogEntryId,
                        principalTable: "bd_catalog_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_catalog_service_configs_CatalogEntryId",
                table: "bd_catalog_service_configs",
                column: "CatalogEntryId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_catalog_service_stages_CatalogEntryId_SortOrder",
                table: "bd_catalog_service_stages",
                columns: new[] { "CatalogEntryId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_catalog_medicines_CatalogEntryId",
                table: "bd_catalog_medicines",
                column: "CatalogEntryId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescription_template_lines_CatalogEntryId_SortOrder",
                table: "bd_prescription_template_lines",
                columns: new[] { "CatalogEntryId", "SortOrder" });

            // The service settings move out of the shared table into the one
            // that owns them; existing services keep the flag they had.
            migrationBuilder.Sql(
                "INSERT INTO \"bd_catalog_service_configs\" " +
                "(\"Id\", \"CatalogEntryId\", \"TaxRate\", \"PriceIncludesTax\", \"DiscountIsPercent\", " +
                " \"DiscountValue\", \"RequireImage\", \"DeductDoctorOnWarranty\", \"SeparateRevenue\", " +
                " \"ShowToothOnInvoice\", \"RevenueByStage\", \"RequireStageSequence\", \"WarrantyDays\") " +
                "SELECT gen_random_uuid(), e.\"Id\", 0, false, true, 0, " +
                "       e.\"IsImageRequired\", false, false, false, false, false, 0 " +
                "FROM \"bd_catalog_entries\" e " +
                "WHERE e.\"Group\" = 'care_service';");

            migrationBuilder.DropColumn(name: "IsImageRequired", table: "bd_catalog_entries");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsImageRequired",
                table: "bd_catalog_entries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                "UPDATE \"bd_catalog_entries\" e " +
                "SET \"IsImageRequired\" = c.\"RequireImage\" " +
                "FROM \"bd_catalog_service_configs\" c " +
                "WHERE c.\"CatalogEntryId\" = e.\"Id\";");

            migrationBuilder.DropTable(name: "bd_prescription_template_lines");
            migrationBuilder.DropTable(name: "bd_catalog_medicines");
            migrationBuilder.DropTable(name: "bd_catalog_service_stages");
            migrationBuilder.DropTable(name: "bd_catalog_service_configs");

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "bd_catalog_entries",
                type: "character varying(8000)",
                maxLength: 8000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.DropColumn(name: "Unit", table: "bd_catalog_entries");
            migrationBuilder.DropColumn(name: "Note", table: "bd_catalog_entries");
            migrationBuilder.DropColumn(name: "DetailName", table: "bd_catalog_entries");
        }
    }
}
