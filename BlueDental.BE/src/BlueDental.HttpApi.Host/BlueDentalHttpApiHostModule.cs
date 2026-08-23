using BlueDental.EntityFrameworkCore;
using BlueDental.Hubs;
using BlueDental.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using Volo.Abp;
using Volo.Abp.Account.Web;
using Volo.Abp.AspNetCore.Mvc;
using Volo.Abp.AspNetCore.Mvc.AntiForgery;
using Volo.Abp.AspNetCore.Serilog;
using Volo.Abp.Autofac;
using Volo.Abp.BlobStoring.Minio;
using Volo.Abp.Caching.StackExchangeRedis;
using Volo.Abp.MailKit;
using Volo.Abp.Modularity;
using Volo.Abp.OpenIddict;
using Volo.Abp.Security.Claims;
using Volo.Abp.Swashbuckle;
using Volo.Abp.Timing;

namespace BlueDental;

[DependsOn(
    typeof(BlueDentalHttpApiModule),
    typeof(AbpAutofacModule),
    typeof(BlueDentalApplicationModule),
    typeof(BlueDentalEntityFrameworkCoreModule),
    typeof(AbpAccountWebOpenIddictModule),
    typeof(AbpMailKitModule),
    typeof(AbpAspNetCoreSerilogModule),
    typeof(AbpSwashbuckleModule),
    typeof(AbpBlobStoringMinioModule),
    typeof(AbpCachingStackExchangeRedisModule)
)]
public class BlueDentalHttpApiHostModule : AbpModule
{
    public override void PreConfigureServices(ServiceConfigurationContext context)
    {
        PreConfigure<AbpAspNetCoreMvcOptions>(options =>
        {
            options.ConventionalControllers.Create(
                typeof(BlueDentalApplicationModule).Assembly,
                controllerOptions =>
                {
                    controllerOptions.RootPath = "app";
                });
        });

        PreConfigure<OpenIddictBuilder>(builder =>
        {
            builder.AddValidation(options =>
            {
                options.AddAudiences("BlueDental");
                options.UseLocalServer();
                options.UseAspNetCore();
            });
        });

        PreConfigure<OpenIddictServerBuilder>(builder =>
        {
            builder.SetAccessTokenLifetime(TimeSpan.FromMinutes(15));
            builder.SetRefreshTokenLifetime(TimeSpan.FromDays(14));
        });
    }

    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        var configuration = context.Services.GetConfiguration();
        var hostingEnvironment = context.Services.GetHostingEnvironment();

        ConfigureAuthentication(context);
        ConfigureUrls(configuration);
        ConfigureCors(context, configuration);
        ConfigureSwagger(context, configuration);
        ConfigureBlobStorage(configuration);
        ConfigureClock();
        ConfigureDataProtection(context, configuration);
        ConfigureAntiForgery();

        context.Services.AddSignalR(options =>
        {
            options.EnableDetailedErrors = hostingEnvironment.IsDevelopment();
            options.KeepAliveInterval = TimeSpan.FromSeconds(15);
            options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
        });

        context.Services.AddHealthChecks();
    }

    private void ConfigureAuthentication(ServiceConfigurationContext context)
    {
        Configure<AbpClaimsPrincipalFactoryOptions>(options =>
        {
            options.IsDynamicClaimsEnabled = true;
            options.Contributors.Add<ClinicBranchClaimsPrincipalContributor>();
        });

        context.Services.ConfigureApplicationCookie(options =>
        {
            options.Events.OnRedirectToLogin = ctx =>
            {
                if (ctx.Request.Path.StartsWithSegments("/api"))
                {
                    ctx.Response.StatusCode = 401;
                    return System.Threading.Tasks.Task.CompletedTask;
                }
                ctx.Response.Redirect(ctx.RedirectUri);
                return System.Threading.Tasks.Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = ctx =>
            {
                if (ctx.Request.Path.StartsWithSegments("/api"))
                {
                    ctx.Response.StatusCode = 403;
                    return System.Threading.Tasks.Task.CompletedTask;
                }
                ctx.Response.Redirect(ctx.RedirectUri);
                return System.Threading.Tasks.Task.CompletedTask;
            };
        });

        context.Services.ConfigureApplicationCookie(options =>
        {
            options.Events.OnRedirectToLogin = ctx =>
            {
                if (ctx.Request.Path.StartsWithSegments("/api"))
                {
                    ctx.Response.StatusCode = 401;
                    return System.Threading.Tasks.Task.CompletedTask;
                }
                ctx.Response.Redirect(ctx.RedirectUri);
                return System.Threading.Tasks.Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = ctx =>
            {
                if (ctx.Request.Path.StartsWithSegments("/api"))
                {
                    ctx.Response.StatusCode = 403;
                    return System.Threading.Tasks.Task.CompletedTask;
                }
                ctx.Response.Redirect(ctx.RedirectUri);
                return System.Threading.Tasks.Task.CompletedTask;
            };
        });
    }

    private void ConfigureUrls(IConfiguration configuration)
    {
        Configure<Volo.Abp.UI.Navigation.Urls.AppUrlOptions>(options =>
        {
            options.Applications["MVC"].RootUrl = configuration["App:SelfUrl"];
            options.Applications["Angular"].RootUrl = configuration["App:ClientUrl"];
        });
    }

    private void ConfigureCors(ServiceConfigurationContext context, IConfiguration configuration)
    {
        context.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(builder =>
            {
                builder
                    .WithOrigins(configuration["App:CorsOrigins"]?
                        .Split(",", StringSplitOptions.RemoveEmptyEntries)
                        .Select(o => o.TrimEnd('/'))
                        .ToArray() ?? [])
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials()
                    .SetPreflightMaxAge(TimeSpan.FromHours(1));
            });
        });
    }

    private void ConfigureSwagger(ServiceConfigurationContext context, IConfiguration configuration)
    {
        context.Services.AddAbpSwaggerGenWithOAuth(
            configuration["AuthServer:Authority"]!,
            new Dictionary<string, string>
            {
                { "BlueDental", "BlueDental API" }
            },
            options =>
            {
                options.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "BlueDental API",
                    Description = "Dental clinic management system REST API",
                    Version = "v1"
                });
                options.DocInclusionPredicate((_, _) => true);
                options.CustomSchemaIds(t => t.FullName);
            });
    }

    private void ConfigureBlobStorage(IConfiguration configuration)
    {
        Configure<Volo.Abp.BlobStoring.AbpBlobStoringOptions>(options =>
        {
            options.Containers.ConfigureDefault(container =>
            {
                container.UseMinio(minio =>
                {
                    minio.EndPoint = configuration["BlobStorage:Endpoint"]!;
                    minio.AccessKey = configuration["BlobStorage:AccessKey"]!;
                    minio.SecretKey = configuration["BlobStorage:SecretKey"]!;
                    minio.BucketName = configuration["BlobStorage:BucketName"]!;
                    minio.WithSSL = configuration.GetValue("BlobStorage:WithSsl", false);
                    minio.CreateBucketIfNotExists = true;
                });
            });
        });
    }

    private void ConfigureClock()
    {
        Configure<AbpClockOptions>(options =>
        {
            options.Kind = DateTimeKind.Utc;
        });
    }

    private static void ConfigureDataProtection(
        ServiceConfigurationContext context,
        IConfiguration configuration)
    {
        var builder = context.Services
            .AddDataProtection()
            .SetApplicationName("BlueDental");

        var keysPath = configuration["DataProtection:KeysPath"];
        if (!string.IsNullOrWhiteSpace(keysPath))
        {
            builder.PersistKeysToFileSystem(new DirectoryInfo(keysPath));
        }
    }

    private void ConfigureAntiForgery()
    {
        Configure<AbpAntiForgeryOptions>(options =>
        {
            options.AutoValidate = false;
        });
    }

    public override void OnApplicationInitialization(ApplicationInitializationContext context)
    {
        var app = context.GetApplicationBuilder();
        var env = context.GetEnvironment();

        if (!env.IsDevelopment())
        {
            app.UseHsts();
            app.UseHttpsRedirection();
        }

        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.UseAbpRequestLocalization();
        app.UseCorrelationId();
        app.UseStaticFiles();
        app.UseRouting();
        app.UseCors();
        app.UseAuthentication();
        app.UseAbpOpenIddictValidation();
        app.UseUnitOfWork();
        app.UseDynamicClaims();
        app.UseAuthorization();

        if (env.IsDevelopment())
        {
            app.UseSwagger();
            app.UseAbpSwaggerUI(options =>
            {
                options.SwaggerEndpoint("/swagger/v1/swagger.json", "BlueDental API v1");
                var swaggerConfiguration = context.GetConfiguration();
                options.OAuthClientId(swaggerConfiguration["AuthServer:SwaggerClientId"]);
                options.OAuthScopes("BlueDental");
            });
        }

        app.UseAuditing();
        app.UseAbpSerilogEnrichers();
        app.UseConfiguredEndpoints(endpoints =>
        {
            endpoints.MapHub<NotificationHub>("/signalr/notifications")
                .RequireAuthorization();
            endpoints.MapHealthChecks("/health/live");
            endpoints.MapHealthChecks("/health/ready");
            endpoints.MapHealthChecks("/health");
        });
    }
}
