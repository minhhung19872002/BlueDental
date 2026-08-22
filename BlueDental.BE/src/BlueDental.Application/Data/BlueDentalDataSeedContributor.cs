using System;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Data;

public class BlueDentalDataSeedContributor(
    IRepository<ClinicBranch, Guid> branchRepository) : IDataSeedContributor, ITransientDependency
{
    public static readonly Guid DefaultBranchId = new("11111111-1111-1111-1111-111111111111");

    public async Task SeedAsync(DataSeedContext context)
    {
        await SeedDefaultBranchAsync();
    }

    private async Task SeedDefaultBranchAsync()
    {
        if (await branchRepository.AnyAsync(b => b.Id == DefaultBranchId))
        {
            return;
        }

        var branch = new ClinicBranch(
            id: DefaultBranchId,
            code: "BD-001",
            name: "BlueDental - Chi nhánh chính",
            address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
            phoneNumber: "02812345678",
            email: "info@bluedental.vn"
        );

        branch.SetOperatingHours(new TimeOnly(8, 0), new TimeOnly(20, 0));

        await branchRepository.InsertAsync(branch, autoSave: true);
    }
}
