using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ChatClientMessageIdR1162 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ClientMessageId",
                table: "bd_chat_messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_chat_messages_ConversationId_SenderId_ClientMessageId",
                table: "bd_chat_messages",
                columns: new[] { "ConversationId", "SenderId", "ClientMessageId" },
                unique: true,
                filter: "\"ClientMessageId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_chat_messages_ConversationId_SenderId_ClientMessageId",
                table: "bd_chat_messages");

            migrationBuilder.DropColumn(
                name: "ClientMessageId",
                table: "bd_chat_messages");
        }
    }
}
