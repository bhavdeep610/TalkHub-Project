using ChatApp.Models.DTOs;
using ChatApp.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private static readonly HashSet<string> _verifiedEmails = new();

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(Register dto)
        {
            var result = await _authService.RegisterAsync(dto);
            if (result == "User already exists")
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(Login dto)
        {
            var result = await _authService.LoginAsync(dto);
            if (result.Token == null)
                return Unauthorized("Invalid credentials");
            return Ok(new { Token = result.Token, UserId = result.UserId });
        }

        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
        {
            try
            {
                var user = await _authService.GetUserByEmailAsync(request.Email);
                if (user == null)
                {
                    return BadRequest(new { message = "Email not found." });
                }

                // Store the verified email
                _verifiedEmails.Add(request.Email);

                return Ok(new { message = "Email verified successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to verify email", error = ex.Message });
            }
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            try
            {
                // Check if email was verified
                if (!_verifiedEmails.Contains(request.Email))
                {
                    return BadRequest(new { message = "Please verify your email first." });
                }

                // Reset the password
                var result = await _authService.ResetPasswordAsync(request.Email, request.NewPassword);
                if (!result)
                {
                    return BadRequest(new { message = "Failed to reset password." });
                }

                // Remove email from verified list after successful reset
                _verifiedEmails.Remove(request.Email);

                return Ok(new { message = "Password has been reset successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to reset password", error = ex.Message });
            }
        }
    }
}
