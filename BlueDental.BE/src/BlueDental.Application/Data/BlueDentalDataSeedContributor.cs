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
    /// The admin account needs the ClinicBranchId extra property so that
    /// <see cref="Application.Organizations.CurrentClinicBranchResolver"/> can
    /// resolve a default branch. But admin must NOT have a
    /// <see cref="StaffBranchAssignment"/> — that would restrict the header's
    /// branch switcher to only that branch instead of showing all branches
    /// (clinic-wide access).
    /// </summary>
    private async Task AssignAdminToDefaultBranchAsync()
    {
        var admin = await userManager.FindByNameAsync("admin");
        if (admin is null)
        {
            return;
        }

        if (admin.GetProperty<Guid?>(BlueDentalConsts.UserClinicBranchIdPropertyName) is null)
        {
            admin.SetProperty(BlueDentalConsts.UserClinicBranchIdPropertyName, DefaultBranchId);
            await userManager.UpdateAsync(admin);
        }

        // Admin is clinic-wide: remove any branch assignment so
        // BranchAccessChecker.GetAllowedBranchIdsAsync returns empty (= no limit).
        var assignments = await assignmentRepository.GetListAsync(a => a.StaffId == admin.Id);
        foreach (var a in assignments)
        {
            await assignmentRepository.DeleteAsync(a, autoSave: true);
        }
    }

    private const string DefaultBranchName = "Nha Khoa Đức Hạnh Premium";

    private async Task SeedDefaultBranchAsync()
    {
        // An existing row is corrected rather than skipped: the guard used to
        // return here, so renaming the branch in this file never reached a
        // database that already had it.
        var existing = await branchRepository.FindAsync(b => b.Id == DefaultBranchId);
        if (existing is not null)
        {
            if (existing.Name != DefaultBranchName)
            {
                existing.SetName(DefaultBranchName);
                await branchRepository.UpdateAsync(existing, autoSave: true);
            }

            return;
        }

        var branch = new ClinicBranch(
            id: DefaultBranchId,
            code: "BD-001",
            name: DefaultBranchName,
            address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
            phoneNumber: "02812345678",
            email: "info@bluedental.vn"
        );

        branch.SetOperatingHours(new TimeOnly(8, 0), new TimeOnly(20, 0));

        await branchRepository.InsertAsync(branch, autoSave: true);
    }
}
