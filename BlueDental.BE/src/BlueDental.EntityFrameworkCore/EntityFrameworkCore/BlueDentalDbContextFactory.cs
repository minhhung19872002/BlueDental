using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace BlueDental.EntityFrameworkCore;

/// <summary>
/// Design-time factory used by EF Core CLI tools (dotnet ef migrations add).
/// </summary>
public class BlueDentalDbContextFactory : IDesignTimeDbContextFactory<BlueDentalDbContext>
{
    public BlueDentalDbContext CreateDbContext(string[] args)
    {
        var configuration = BuildConfiguration();

        var builder = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseNpgsql(configuration.GetConnectionString("Default"));

        return new BlueDentalDbContext(builder.Options);
    }

    private static IConfigurationRoot BuildConfiguration()
    {
        var builder = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(
                Directory.GetCurrentDirectory(),
                "../../src/BlueDental.DbMigrator"))
            .AddJsonFile("appsettings.json", optional: false);

        return builder.Build();
    }
}
