using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Migrations
{
    /// <inheritdoc />
    public partial class newmigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 5, 23, 8, 29, 49, 693, DateTimeKind.Utc).AddTicks(9000));

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 5, 23, 8, 29, 49, 693, DateTimeKind.Utc).AddTicks(9002));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 5, 23, 8, 29, 49, 693, DateTimeKind.Utc).AddTicks(8274));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 5, 23, 8, 29, 49, 693, DateTimeKind.Utc).AddTicks(8278));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 3,
                column: "created",
                value: new DateTime(2025, 5, 23, 8, 29, 49, 693, DateTimeKind.Utc).AddTicks(8279));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(7750));

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(7752));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(6177));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(6182));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 3,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(6184));
        }
    }
}
