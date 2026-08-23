using System;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Identity;

namespace BlueDental.Data;

public class BlueDentalDataSeedContributor(
    IRepository<ClinicBranch, Guid> branchRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IdentityUserManager userManager,
    IGuidGenerator guidGenerator) : IDataSeedContributor, ITransientDependency
{
    public static readonly Guid DefaultBranchId = new("11111111-1111-1111-1111-111111111111");

    public async Task SeedAsync(DataSeedContext context)
    {
        await SeedDefaultBranchAsync();
        await AssignAdminToDefaultBranchAsync();
    }

    /// <summary>
    /// Every business call resolves its clinic from the signed-in user, and a
    /// user with no branch is refused outright. The admin account is seeded
    /// without one, so it gets the default clinic here — otherwise the very
    /// first screen after install answers BranchNotAssigned.
    /// </summary>
    private async Task AssignAdminToDefaultBranchAsync()
    {
        var admin = await userManager.FindByNameAsync("admin");
        if (admin is null)
        {
            return;
        }

        // The claim the resolver reads comes from this extra property, so it is
        // what actually unblocks the API; the assignment row is what the rota
        // and staff lists read.
        if (admin.GetProperty<Guid?>(BlueDentalConsts.UserClinicBranchIdPropertyName) is null)
        {
            admin.SetProperty(BlueDentalConsts.UserClinicBranchIdPropertyName, DefaultBranchId);
            await userManager.UpdateAsync(admin);
        }

        if (await assignmentRepository.AnyAsync(a => a.StaffId == admin.Id))
        {
            return;
        }

        await assignmentRepository.InsertAsync(
            StaffBranchAssignment.Assign(guidGenerator.Create(), admin.Id, DefaultBranchId, isPrimary: true),
            autoSave: true);
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
