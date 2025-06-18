using ChatApp.Models.DTOs;
using ChatApp.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace ChatApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ILogger<AuthController> _logger;
        private static readonly HashSet<string> _verifiedEmails = new();

        public AuthController(IAuthService authService, ILogger<AuthController> logger)
        {
            _authService = authService;
            _logger = logger;
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
                _logger.LogInformation($"Attempting to verify email: {request.Email}");
                
                var user = await _authService.GetUserByEmailAsync(request.Email);
                if (user == null)
                {
                    _logger.LogWarning($"Email not found: {request.Email}");
                    return BadRequest(new { message = "Email not found." });
                }

                _verifiedEmails.Add(request.Email);
                _logger.LogInformation($"Email verified successfully: {request.Email}");

                return Ok(new { message = "Email verified successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to verify email: {request.Email}");
                return StatusCode(500, new { message = "Failed to verify email", error = ex.Message });
            }
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            try
            {
                _logger.LogInformation($"Attempting to reset password for email: {request.Email}");

                if (!_verifiedEmails.Contains(request.Email))
                {
                    _logger.LogWarning($"Email not verified before password reset attempt: {request.Email}");
                    return BadRequest(new { message = "Please verify your email first." });
                }

                var result = await _authService.ResetPasswordAsync(request.Email, request.NewPassword);
                if (!result)
                {
                    _logger.LogWarning($"Failed to reset password for email: {request.Email}");
                    return BadRequest(new { message = "Failed to reset password." });
                }

                _verifiedEmails.Remove(request.Email);
                _logger.LogInformation($"Password reset successful for email: {request.Email}");

                return Ok(new { message = "Password has been reset successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to reset password for email: {request.Email}");
                return StatusCode(500, new { message = "Failed to reset password", error = ex.Message });
            }
        }
    }
}
