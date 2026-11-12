using BlueDental.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// SQL only, no change to the model: <c>bd_try_jsonb</c> reads a sheet's
    /// content as JSON, or as NULL when it is not, so the field suggestions of
    /// R-1219 can read one blank out of every sheet without one malformed
    /// sheet failing the whole query (PostgreSQL 15 has no <c>IS JSON</c>).
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20261112120000_MedicalRecordFieldSuggestionsR1219")]
    public partial class MedicalRecordFieldSuggestionsR1219 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION bd_try_jsonb(value text) RETURNS jsonb
                LANGUAGE plpgsql IMMUTABLE AS $$
                BEGIN
                    RETURN value::jsonb;
                EXCEPTION WHEN others THEN
                    RETURN NULL;
                END
                $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS bd_try_jsonb(text);");
        }
    }
}
