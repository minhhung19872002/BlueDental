using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Khớp cắn, Đường hoàn tất and Kiểu nhịp move into the shared taxonomy.
    ///
    /// The reference keeps all three in its one taxonomy collection
    /// (<c>GET /api/v1/taxonomy/list?group=joint|line|bridge</c>) rather than in
    /// tables of their own — see docs/clone/pages/labo.md §4. BlueDental already
    /// had the matching groups declared in <c>TaxonomyGroups</c> and already
    /// mapped their ability subjects in <c>TaxonomyGroupAbilities</c>; only the
    /// three placeholder tables were left, and those carried no branch of their
    /// own, so a row created in one clinic branch was visible from every other.
    ///
    /// The tables were never seeded and nothing referenced their rows, so they
    /// go rather than being migrated across.
    ///
    /// Hand-written for the reason given in AddDepartmentSortOrder: the model
    /// snapshot has drifted for unrelated entities, so a scaffolded migration
    /// would sweep up changes that belong to other work.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260827110000_RemoveLaboCatalogTables")]
    public partial class RemoveLaboCatalogTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "bd_labo_bite_types");
            migrationBuilder.DropTable(name: "bd_labo_finish_lines");
            migrationBuilder.DropTable(name: "bd_labo_rhythm_types");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            CreateCatalogTable(migrationBuilder, "bd_labo_bite_types");
            CreateCatalogTable(migrationBuilder, "bd_labo_finish_lines");
            CreateCatalogTable(migrationBuilder, "bd_labo_rhythm_types");
        }

        /// <summary>
        /// All three tables were the same shape, so rolling back builds them
        /// from one description rather than three copies of it.
        /// </summary>
        private static void CreateCatalogTable(MigrationBuilder migrationBuilder, string table)
        {
            migrationBuilder.CreateTable(
                name: table,
                columns: table2 => new
                {
                    Id = table2.Column<Guid>(type: "uuid", nullable: false),
                    Name = table2.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table2.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table2.Column<bool>(type: "boolean", nullable: false),
                    ExtraProperties = table2.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table2.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table2.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table2.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table2.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table2.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table2.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table2.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table2.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: constraints => constraints.PrimaryKey($"PK_{table}", x => x.Id));
        }
    }
}
