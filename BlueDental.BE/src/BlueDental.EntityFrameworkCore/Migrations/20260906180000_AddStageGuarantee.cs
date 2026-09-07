using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Bảo hành on a công đoạn.
    ///
    /// The reference's "Tạo bảo hành" writes an ordinary công đoạn with
    /// <c>isGuarantee: true</c> — the warranty visit is a step of the same
    /// service, which is why the treatment table's Bảo hành filter can pick them
    /// out. Only a finished công đoạn on a service that carries a warranty period
    /// offers the button.
    ///
    /// Hand-written for the reason given in AddAppointmentChangeLog — the model
    /// snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260906180000_AddStageGuarantee")]
    public partial class AddStageGuarantee : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsGuarantee",
                table: "bd_treatment_stages",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsGuarantee",
                table: "bd_treatment_stages");
        }
    }
}
