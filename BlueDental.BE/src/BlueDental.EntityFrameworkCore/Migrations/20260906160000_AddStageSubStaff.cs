using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Phụ tá on a công đoạn.
    ///
    /// The reference's stage keeps two helper slots, not one: <c>assistantStaffId</c>
    /// is the second dentist ("Bác sĩ hỗ trợ", already stored as
    /// <c>SecondStaffId</c>) and <c>subStaffId</c> is the nurse assisting
    /// ("Phụ tá"), which had nowhere to go. Its history row prints both, so both
    /// have to be kept — until now BlueDental collected Phụ tá in the form and
    /// dropped it on save.
    ///
    /// Nullable, and no foreign key to the identity table for the same reason the
    /// other staff columns have none: staff records outlive their assignments.
    ///
    /// Hand-written for the reason given in AddAppointmentChangeLog — the model
    /// snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260906160000_AddStageSubStaff")]
    public partial class AddStageSubStaff : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SubStaffId",
                table: "bd_treatment_stages",
                type: "uuid",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SubStaffId",
                table: "bd_treatment_stages");
        }
    }
}
