using BlueDental;
using BlueDental.Application.Tests;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp;
using Volo.Abp.BackgroundJobs;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.EntityFrameworkCore;
using Volo.Abp.EntityFrameworkCore.Sqlite;
using Volo.Abp.Modularity;

namespace BlueDental.EntityFrameworkCore.Tests;

[DependsOn(
    typeof(BlueDentalApplicationTestModule),
    typeof(BlueDentalEntityFrameworkCoreModule),
    typeof(AbpEntityFrameworkCoreSqliteModule)
)]
public class BlueDentalEntityFrameworkCoreTestModule : AbpModule
{
    private SqliteConnection? _sqliteConnection;

    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        Configure<AbpDbContextOptions>(options =>
        {
            options.Configure(dbContextConfigurationContext =>
            {
                dbContextConfigurationContext.DbContextOptions
                    .UseSqlite(CreateDatabaseAndGetConnection());
            });
        });

        context.Services.Configure<AbpBackgroundJobOptions>(opts =>
        {
            opts.IsJobExecutionEnabled = false;
        });

        context.Services.Configure<AbpBackgroundWorkerOptions>(opts =>
        {
            opts.IsEnabled = false;
        });
    }

    public override void OnApplicationShutdown(ApplicationShutdownContext context)
    {
        _sqliteConnection?.Dispose();
    }

    private SqliteConnection CreateDatabaseAndGetConnection()
    {
        _sqliteConnection = new SqliteConnection("Data Source=:memory:");
        _sqliteConnection.Open();

        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite(_sqliteConnection)
            .Options;

        using var context = new BlueDentalDbContext(options);
        context.GetService<IRelationalDatabaseCreator>().CreateTables();

        return _sqliteConnection;
    }
}
