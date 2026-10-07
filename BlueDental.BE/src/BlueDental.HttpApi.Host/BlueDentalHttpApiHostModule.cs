using System.Net;
using BlueDental.EntityFrameworkCore;
using BlueDental.Hubs;
using BlueDental.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using Volo.Abp;
using Volo.Abp.Account.Web;
using Volo.Abp.AspNetCore.ExceptionHandling;
using Volo.Abp.AspNetCore.Mvc;
using Volo.Abp.AspNetCore.Mvc.AntiForgery;
using Volo.Abp.AspNetCore.Mvc.Libs;
using Volo.Abp.AspNetCore.Serilog;
using Volo.Abp.AspNetCore.Uow;
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
        // No conventional (auto API) controllers for the Application assembly.
        //
        // Every service is exposed by a hand-written controller in
        // BlueDental.HttpApi. Registering the assembly here as well made ABP
        // treat each application service as a controller type and exclude it
        // from dynamic proxying, so the [Authorize] attributes on the services
        // were never enforced when the controllers called them.
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

        // Sign-in refuses an address outside the account's branch networks or
        // a time outside its branches' allowed hours (Cụm 11 mục 11, 13).
        // Registered after ABP's AbpSignInManager, so it wins.
        PreConfigure<IdentityBuilder>(builder => builder.AddSignInManager<BlueDentalSignInManager>());
    }

    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        var configuration = context.Services.GetConfiguration();
        var hostingEnvironment = context.Services.GetHostingEnvironment();

        ConfigureAuthentication(context);
        ConfigureForwardedHeaders(context);
        ConfigureUrls(configuration);
        ConfigureCors(context, configuration);
        ConfigureSwagger(context, configuration);
        ConfigureBlobStorage(configuration);
        ConfigureClock();
        ConfigureDataProtection(context, configuration);
        ConfigureAntiForgery();
        ConfigureExceptionStatusCodes();
        ConfigureUnitOfWork();

        // wwwroot only holds print templates (PHIẾU THU.docx); this host serves
        // no client-side libs, so ABP's wwwroot/libs startup check is noise.
        Configure<AbpMvcLibsOptions>(options => options.CheckLibs = false);

        // Cụm 11 mục 9: "Ẩn số điện thoại" masks patient phones on the way out.
        Configure<Microsoft.AspNetCore.Mvc.MvcOptions>(options =>
            options.Filters.AddService<PatientPhoneMaskingFilter>());

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

    /// <summary>
    /// Which address counts as the client's when X-Forwarded-For is honoured
    /// (production sets ASPNETCORE_FORWARDEDHEADERS_ENABLED).
    ///
    /// Requests pass Caddy, then the frontend's nginx, so the header reads
    /// "client, caddy". The default (trust everything, one hop) took the last
    /// entry — Caddy's own address — and the branch IP check (Cụm 11 mục 11)
    /// would have compared every user against the proxy. Trusting only the
    /// loopback and private networks the proxies live on, with no hop limit,
    /// walks back to the first address that is not a proxy: the client's.
    /// A client cannot forge its way in by sending the header itself — any
    /// public address it writes is to the left of the real one.
    /// </summary>
    private static void ConfigureForwardedHeaders(ServiceConfigurationContext context)
    {
        context.Services.PostConfigure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardLimit = null;
            options.KnownProxies.Clear();
            options.KnownNetworks.Clear();
            foreach (var network in new[] { "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fc00::/7" })
            {
                options.KnownNetworks.Add(Microsoft.AspNetCore.HttpOverrides.IPNetwork.Parse(network));
            }
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

    /// <summary>
    /// API requests commit their unit of work before the response is written.
    ///
    /// <c>UseUnitOfWork()</c> reserves one unit of work for the whole request;
    /// the MVC filter then only saves changes, and the middleware commits after
    /// the response has gone out, on the request's abort token. A client that
    /// navigates away the moment it reads the 200 cancels that commit, and the
    /// write is rolled back behind a success the user has already seen (R-606:
    /// a saved line note vanished on reload). Outside the reservation ABP's
    /// <c>AbpUowActionFilter</c> begins its own unit of work and completes it
    /// before the result runs, so a failed commit also answers as an error
    /// instead of "response has already started". Every /api endpoint here is a
    /// controller action, so each still runs inside that filter's unit of work.
    /// </summary>
    private void ConfigureUnitOfWork()
    {
        Configure<AbpAspNetCoreUnitOfWorkOptions>(options =>
        {
            options.IgnoredUrls.AddIfNotContains("/api");
        });
    }

    private void ConfigureExceptionStatusCodes()
    {
        Configure<AbpExceptionHttpStatusCodeOptions>(options =>
        {
            options.Map(BlueDentalDomainErrorCodes.Appointments.ConflictingSlot, HttpStatusCode.Conflict);
            options.Map(BlueDentalDomainErrorCodes.Appointments.PatientAlreadyBooked, HttpStatusCode.Conflict);

            options.Map(BlueDentalDomainErrorCodes.Appointments.InvalidTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiagnosisTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.Labo.InvalidTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.Promotions.InvalidVoucherTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.CustomerCare.InvalidTransition, HttpStatusCode.UnprocessableEntity);
            options.Map(BlueDentalDomainErrorCodes.Operations.InvalidTaskTransition, HttpStatusCode.UnprocessableEntity);
        });
    }

    public override async Task OnPostApplicationInitializationAsync(ApplicationInitializationContext context)
    {
        await context.ServiceProvider.GetRequiredService<HidePhoneCacheReset>().ResetAsync();
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
        app.UseMiddleware<SignInRestrictionMiddleware>();
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
            endpoints.MapHub<QueueHub>("/signalr/queue");
            endpoints.MapHealthChecks("/health/live");
            endpoints.MapHealthChecks("/health/ready");
            endpoints.MapHealthChecks("/health");
        });
    }
}
