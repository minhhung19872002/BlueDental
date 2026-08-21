using System;
using System.Threading.Tasks;
using BlueDental.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.DependencyInjection;

namespace BlueDental.EntityFrameworkCore;

public class EntityFrameworkCoreBlueDentalDbSchemaMigrator
    : IBlueDentalDbSchemaMigrator, ITransientDependency
{
    private readonly IServiceProvider _serviceProvider;

    public EntityFrameworkCoreBlueDentalDbSchemaMigrator(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task MigrateAsync()
    {
        await _serviceProvider
            .GetRequiredService<BlueDentalDbContext>()
            .Database
            .MigrateAsync();
    }
}
