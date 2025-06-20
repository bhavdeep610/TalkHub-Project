using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageUpdatedTimestamp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "Updated",
                table: "message",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 1,
                columns: new[] { "created", "Updated" },
                values: new object[] { new DateTime(2025, 6, 17, 12, 40, 18, 17, DateTimeKind.Utc).AddTicks(466), null });

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 2,
                columns: new[] { "created", "Updated" },
                values: new object[] { new DateTime(2025, 6, 17, 12, 40, 18, 17, DateTimeKind.Utc).AddTicks(469), null });

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 6, 17, 12, 40, 18, 16, DateTimeKind.Utc).AddTicks(9111));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 6, 17, 12, 40, 18, 16, DateTimeKind.Utc).AddTicks(9122));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 3,
                column: "created",
                value: new DateTime(2025, 6, 17, 12, 40, 18, 16, DateTimeKind.Utc).AddTicks(9124));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Updated",
                table: "message");

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(5490));

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(5491));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(4844));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(4846));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 3,
                column: "created",
                value: new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(4848));
        }
    }
}
