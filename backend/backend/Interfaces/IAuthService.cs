using ChatApp.Models.DTOs;
using ChatApp.Models;

namespace ChatApp.Interfaces
{
    public interface IAuthService
    {
        Task<string> RegisterAsync(Register model);
        Task<LoginResponse> LoginAsync(Login model);
        Task<User> GetUserByEmailAsync(string email);
        Task<bool> ResetPasswordAsync(string email, string newPassword);
    }

    public class LoginResponse
    {
        public string Token { get; set; }
        public int UserId { get; set; }
    }
}


