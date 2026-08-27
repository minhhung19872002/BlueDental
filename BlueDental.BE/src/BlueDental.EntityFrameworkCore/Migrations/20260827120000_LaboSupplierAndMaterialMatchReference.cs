using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Nhà cung cấp Labo and Dịch vụ - vật liệu take the shape the reference
    /// gives them — see docs/clone/pages/labo.md §3 and §5.
    ///
    /// The supplier gains a contact person, a tax code, a structured address and
    /// a logo, and — like every other clinic record — a branch of its own; it had
    /// none, so a supplier created in one branch was listed in every other.
    ///
    /// The material stops hanging off a supplier and hangs off a classification
    /// group instead. The reference's groups are named after labs but are
    /// separate records from the supplier list, and its item carries only
    /// `taxonomyId`.
    ///
    /// <b>The three labo demo tables are emptied.</b> A material has no group to
    /// point at and a supplier has no branch to belong to, so there is nothing to
    /// carry across; the rows are all seeded demo data, and DbMigrator writes
    /// them again — coherently — on the next run. The orders go too because the
    /// seeder decides whether to re-seed by looking at them.
    ///
    /// Hand-written for the reason given in AddDepartmentSortOrder: the model
    /// snapshot has drifted for unrelated entities, so a scaffolded migration
    /// would sweep up changes that belong to other work.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260827120000_LaboSupplierAndMaterialMatchReference")]
    public partial class LaboSupplierAndMaterialMatchReference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM bd_labo_materials;");
            migrationBuilder.Sql("DELETE FROM bd_labo_orders;");
            migrationBuilder.Sql("DELETE FROM bd_labo_suppliers;");

            // ── Nhà cung cấp ────────────────────────────────────────────────
            migrationBuilder.AddColumn<Guid>(
                name: "ClinicBranchId",
                table: "bd_labo_suppliers",
                type: "uuid",
                nullable: false,
                defaultValue: Guid.Empty);

            migrationBuilder.AddColumn<string>(
                name: "ContactPerson",
                table: "bd_labo_suppliers",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaxCode",
                table: "bd_labo_suppliers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProvinceCode",
                table: "bd_labo_suppliers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WardCode",
                table: "bd_labo_suppliers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LogoFileId",
                table: "bd_labo_suppliers",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LogoPath",
                table: "bd_labo_suppliers",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_suppliers_ClinicBranchId",
                table: "bd_labo_suppliers",
                column: "ClinicBranchId");

            // ── Vật liệu ────────────────────────────────────────────────────
            migrationBuilder.DropColumn(name: "Category", table: "bd_labo_materials");
            migrationBuilder.DropColumn(name: "Description", table: "bd_labo_materials");
            migrationBuilder.DropColumn(name: "SupplierId", table: "bd_labo_materials");

            migrationBuilder.AddColumn<Guid>(
                name: "ClinicBranchId",
                table: "bd_labo_materials",
                type: "uuid",
                nullable: false,
                defaultValue: Guid.Empty);

            migrationBuilder.AddColumn<Guid>(
                name: "TaxonomyId",
                table: "bd_labo_materials",
                type: "uuid",
                nullable: false,
                defaultValue: Guid.Empty);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "bd_labo_materials",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_materials_ClinicBranchId_TaxonomyId",
                table: "bd_labo_materials",
                columns: ["ClinicBranchId", "TaxonomyId"]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_labo_materials_ClinicBranchId_TaxonomyId",
                table: "bd_labo_materials");

            migrationBuilder.DropColumn(name: "SortOrder", table: "bd_labo_materials");
            migrationBuilder.DropColumn(name: "TaxonomyId", table: "bd_labo_materials");
            migrationBuilder.DropColumn(name: "ClinicBranchId", table: "bd_labo_materials");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "bd_labo_materials",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "bd_labo_materials",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                table: "bd_labo_materials",
                type: "uuid",
                nullable: true);

            migrationBuilder.DropIndex(
                name: "IX_bd_labo_suppliers_ClinicBranchId",
                table: "bd_labo_suppliers");

            foreach (var column in new[]
                     {
                         "LogoPath", "LogoFileId", "WardCode", "ProvinceCode",
                         "TaxCode", "ContactPerson", "ClinicBranchId",
                     })
            {
                migrationBuilder.DropColumn(name: column, table: "bd_labo_suppliers");
            }
        }
    }
}
