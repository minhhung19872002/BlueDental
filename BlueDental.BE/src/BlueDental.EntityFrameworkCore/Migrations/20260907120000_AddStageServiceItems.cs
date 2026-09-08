using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// "Danh sách công đoạn" on a công đoạn — which of the service's own steps it
    /// covers, and which of those are done.
    ///
    /// OBSERVED on the reference 2026-09-07: a công đoạn carries
    /// <c>stageServiceItems[]</c> of
    /// <c>{ stageServiceId, isCompleted, completedAt, staffId }</c>, chosen on the
    /// form and ticked off afterwards from the treatment history row.
    ///
    /// A jsonb column rather than a table, the same way Teeth rides on this
    /// entity: the list is short, never queried on its own, and always read with
    /// the stage. Hand-written, and the model snapshot patched by hand with it —
    /// see AddAppointmentChangeLog for why this project writes them that way.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260907120000_AddStageServiceItems")]
    public partial class AddStageServiceItems : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ServiceItems",
                table: "bd_treatment_stages",
                type: "jsonb",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ServiceItems",
                table: "bd_treatment_stages");
        }
    }
}
