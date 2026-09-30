using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientQuoteLinePricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The lines live in bd_patient_quotes.Lines as JSON, so the four
            // new nullable fields need no column; this keeps the snapshot in
            // step with the model. Lines stored before carry no price and are
            // priced off their consulting line.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
