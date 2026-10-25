using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// R-1029: <c>ZaloAutomaticMessageNoAnswer</c> counted the last answer from
    /// the chat's messages only, but a ZNS sent from Hộp thư Zalo is no chat
    /// message: it is a message log (a template, no send batch — what CSKH and
    /// the OA screen send has a batch or no template), and it answered the
    /// customer when it was sent. Conversations it answered were put back to
    /// "Chưa trả lời"; this gives them their answer again.
    ///
    /// It only ever moves the last answer later, so no conversation becomes
    /// "Chưa trả lời" here. Data only: the snapshot is left as it is.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20261025100000_ZaloInboxZnsStillAnswers")]
    public partial class ZaloInboxZnsStillAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                WITH zns AS (
                    SELECT c."Id", max(l."SentAt") AS "SentAt"
                    FROM bd_zalo_conversations c
                    JOIN bd_message_logs l
                      ON l."ClinicBranchId" = c."ClinicBranchId" AND l."PatientId" = c."PatientId"
                    WHERE l."Channel" = 1
                      AND l."SendBatchId" IS NULL
                      AND l."TemplateId" IS NOT NULL
                      AND l."SentAt" IS NOT NULL
                    GROUP BY c."Id"
                )
                UPDATE bd_zalo_conversations c
                SET "LastReplyAt" = z."SentAt",
                    "Status" = CASE
                        WHEN c."LastCustomerMessageAt" IS NOT NULL AND c."LastCustomerMessageAt" > z."SentAt"
                        THEN 0 ELSE 1 END,
                    "LastModificationTime" = now(),
                    "ConcurrencyStamp" = replace(gen_random_uuid()::text, '-', '')
                FROM zns z
                WHERE z."Id" = c."Id"
                  AND (c."LastReplyAt" IS NULL OR c."LastReplyAt" < z."SentAt");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Taking the answer away again would only bring the fault back.
        }
    }
}
