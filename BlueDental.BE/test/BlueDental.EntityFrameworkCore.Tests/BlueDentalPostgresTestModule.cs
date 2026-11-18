using BlueDental.Application.Tests;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Volo.Abp.BackgroundJobs;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Data;
using Volo.Abp.Modularity;

namespace BlueDental.EntityFrameworkCore.Tests;

/// <summary>
/// The whole application over a throw-away PostgreSQL 15 with the real
/// migrations applied — the SQLite module cannot build the schema (jsonb,
/// Postgres-only index filters), and acceptance has to run on Postgres anyway.
/// One container per test run; every test makes its own rows.
/// </summary>
[DependsOn(
    typeof(BlueDentalApplicationTestModule),
    typeof(BlueDentalEntityFrameworkCoreModule)
)]
public class BlueDentalPostgresTestModule : AbpModule
{
    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        var connectionString = PostgresTestDatabase.ConnectionString;
        Configure<AbpDbConnectionOptions>(o => o.ConnectionStrings.Default = connectionString);
        Configure<AbpBackgroundJobOptions>(o => o.IsJobExecutionEnabled = false);
        Configure<AbpBackgroundWorkerOptions>(o => o.IsEnabled = false);
    }
}

internal static class PostgresTestDatabase
{
    private static readonly object Gate = new();
    private static PostgreSqlContainer? _container;
    private static string? _connectionString;

    public static string ConnectionString
    {
        get
        {
            lock (Gate)
            {
                return _connectionString ??= Start();
            }
        }
    }

    public static void Execute(string sql)
    {
        using var connection = new Npgsql.NpgsqlConnection(ConnectionString);
        connection.Open();
        using var command = new Npgsql.NpgsqlCommand(sql, connection);
        command.ExecuteNonQuery();
    }

    private static string Start()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:15-alpine")
            .WithDatabase("bluedental_test")
            .Build();
        _container.StartAsync().GetAwaiter().GetResult();
        var connectionString = _container.GetConnectionString();

        var options = new DbContextOptionsBuilder<BlueDentalDbContext>().UseNpgsql(connectionString).Options;
        using (var context = new BlueDentalDbContext(options))
        {
            context.Database.Migrate();
        }

        // Testcontainers' reaper removes the container when the test process ends.
        return connectionString;
    }
}

public abstract class BlueDentalPostgresTestBase : BlueDentalTestBase<BlueDentalPostgresTestModule>;
