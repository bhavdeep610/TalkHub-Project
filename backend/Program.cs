using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ChatApp.Models.Entities;
using ChatApp.Data;
using ChatApp.Interfaces;
using ChatApp.Services;
using Microsoft.OpenApi.Models;
using ChatApp.Hubs;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;
using ChatApp.Service;

var builder = WebApplication.CreateBuilder(args);

// Add DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = Environment.GetEnvironmentVariable("MYSQL_URL") ?? 
                         builder.Configuration.GetConnectionString("ChatAppConnection");
    
    if (string.IsNullOrEmpty(connectionString))
    {
        throw new InvalidOperationException("Database connection string is not configured.");
    }

    try 
    {
        // Parse connection string if it's in the mysql:// format
        if (connectionString.StartsWith("mysql://"))
        {
            var uri = new Uri(connectionString);
            var userInfo = uri.UserInfo.Split(':');
            var user = userInfo[0];
            var password = userInfo[1];
            var host = uri.Host;
            var port = uri.Port;
            var database = uri.AbsolutePath.TrimStart('/');

            connectionString = $"Server={host};Port={port};Database={database};User={user};Password={password};";
        }

        var serverVersion = new MySqlServerVersion(new Version(8, 0, 0));
        options.UseMySql(connectionString, serverVersion, mySqlOptions =>
        {
            mySqlOptions.EnableRetryOnFailure(
                maxRetryCount: 10,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null);
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database connection error: {ex.Message}");
        throw;
    }
});

// Add SignalR with detailed configuration
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
    options.MaximumReceiveMessageSize = 32 * 1024; // 32KB
});

// Custom Auth Service
builder.Services.AddScoped<IAuthService, AuthService>();

// Profile Picture Service
builder.Services.AddScoped<CloudinaryService>();
builder.Services.AddScoped<ProfilePictureService>();

// JWT Auth with SignalR support
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JWT:Issuer"],
            ValidAudience = builder.Configuration["JWT:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JWT:Key"]!)
            )
        };

        // Configure JWT Bearer Auth to handle SignalR
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && 
                    (path.StartsWithSegments("/chathub") || path.StartsWithSegments("/hubs/chat")))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// Swagger setup
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "ChatApp API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' followed by your JWT token."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Configure CORS for SignalR
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowViteDevClient", policy =>
    {
        policy.WithOrigins("http://localhost:5173", 
                          "http://127.0.0.1:5173",
                          "https://talk-hub-project.vercel.app",
                          "http://talk-hub-project.vercel.app")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .SetIsOriginAllowed(_ => true); // Be careful with this in production
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Create uploads directory for profile pictures
string contentRootPath = app.Environment.ContentRootPath;
var uploadsPath = Path.Combine(contentRootPath, "wwwroot", "uploads", "profile-pictures");
Directory.CreateDirectory(uploadsPath); // This will create all necessary parent directories

// Auto migrate & seed roles
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.Migrate();

    if (!context.AppRoles.Any())
    {
        context.AppRoles.AddRange(
            new AppRoles { RoleName = "Admin" },
            new AppRoles { RoleName = "User" }
        );
        context.SaveChanges();
    }
}

// Dev tools
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Enable WebSockets
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(120),
});

// Ensure CORS is before routing but after WebSockets
app.UseCors("AllowViteDevClient");

app.UseRouting();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

// Map controllers and hub
app.MapControllers();
app.MapHub<ChatHub>("/chathub");

app.Run();