using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// A branch's code now names it in the address bar (<c>?branch=BD-001</c>)
    /// and can be edited, so no two branches may share one — compared ignoring
    /// case, as the link is matched. Deleted branches count: they still list, and
    /// an old link to one must not open a newer branch that took its code. The
    /// application service refuses a duplicate; this index closes the race
    /// between two saves. The exact-case <c>IX_bd_clinic_branches_Code</c> stays.
    ///
    /// Codes were only compared exactly, so a database may already hold
    /// "bd-001" beside "BD-001". A live branch keeps its code before a deleted
    /// one, then the oldest; each other gets a suffix from its own id, which is
    /// unique, before the index is built.
    ///
    /// Hand-written: an index on lower("Code") is an expression the model cannot
    /// describe, so the snapshot is left as it is.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20261011090000_UniqueBranchCode")]
    public partial class UniqueBranchCode : Migration
    {
        private const string IndexName = "IX_bd_clinic_branches_Code_Lower";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE bd_clinic_branches AS b
                SET "Code" = left(b."Code", 40) || '-' || left(replace(b."Id"::text, '-', ''), 8)
                FROM (
                    SELECT "Id",
                           row_number() OVER (
                               PARTITION BY lower("Code") ORDER BY "IsDeleted", "CreationTime", "Id") AS rank
                    FROM bd_clinic_branches
                ) AS d
                WHERE b."Id" = d."Id" AND d.rank > 1;
                """);

            migrationBuilder.Sql(
                $"CREATE UNIQUE INDEX \"{IndexName}\" ON bd_clinic_branches (lower(\"Code\"));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"DROP INDEX IF EXISTS \"{IndexName}\";");
        }
    }
}
