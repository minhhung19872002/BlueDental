using System;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using Microsoft.Extensions.Configuration;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Data;

/// <summary>
/// Seeds one diagnosis and one service in the default branch.
///
/// The clinical chain — chẩn đoán → tư vấn → công đoạn — cannot start without a
/// diagnosis catalog and a service catalog, so the acceptance suite needs both to
/// exist deterministically rather than depending on an earlier test having run.
///
/// Only runs in Development; a real clinic builds its own catalogs.
/// </summary>
public class BlueDentalCatalogSeedContributor(
    IRepository<Taxonomy, Guid> taxonomyRepository,
    IRepository<CatalogEntry, Guid> catalogRepository,
    IConfiguration configuration) : IDataSeedContributor, ITransientDependency
{
    private static readonly Guid DiagnosisTaxonomyId = new("33333333-0000-0000-0000-000000000001");
    private static readonly Guid ServiceTaxonomyId = new("33333333-0000-0000-0000-000000000002");
    private static readonly Guid DiagnosisEntryId = new("33333333-1111-0000-0000-000000000001");
    private static readonly Guid ServiceEntryId = new("33333333-1111-0000-0000-000000000002");

    public async Task SeedAsync(DataSeedContext context)
    {
        if (!IsDevelopment())
        {
            return;
        }

        await SeedAsync(
            DiagnosisTaxonomyId,
            DiagnosisEntryId,
            TaxonomyGroups.Diagnosis,
            groupName: "Nhóm chẩn đoán chung",
            entryName: "Sâu ngà",
            price: null);

        await SeedAsync(
            ServiceTaxonomyId,
            ServiceEntryId,
            TaxonomyGroups.CareService,
            groupName: "Nhóm dịch vụ chung",
            entryName: "Trám răng thẩm mỹ",
            price: 500_000m);
    }

    private bool IsDevelopment() =>
        string.Equals(
            configuration["ASPNETCORE_ENVIRONMENT"]
                ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

    private async Task SeedAsync(
        Guid taxonomyId,
        Guid entryId,
        string group,
        string groupName,
        string entryName,
        decimal? price)
    {
        if (!await taxonomyRepository.AnyAsync(x => x.Id == taxonomyId))
        {
            await taxonomyRepository.InsertAsync(
                Taxonomy.Create(taxonomyId, BlueDentalDataSeedContributor.DefaultBranchId, group, groupName),
                autoSave: true);
        }

        if (!await catalogRepository.AnyAsync(x => x.Id == entryId))
        {
            await catalogRepository.InsertAsync(
                CatalogEntry.Create(
                    entryId,
                    BlueDentalDataSeedContributor.DefaultBranchId,
                    taxonomyId,
                    group,
                    entryName,
                    price: price),
                autoSave: true);
        }
    }
}
