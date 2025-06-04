
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
            var token = await _authService.LoginAsync(dto);
            if (token == null)
                return Unauthorized("Invalid credentials");
            return Ok(new { Token = token });
       
        }

    }
}
