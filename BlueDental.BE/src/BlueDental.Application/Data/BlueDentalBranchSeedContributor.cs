using System;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Microsoft.Extensions.Configuration;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Identity;

namespace BlueDental.Data;

/// <summary>
/// Seeds a second clinic branch and the two accounts branch behaviour needs:
/// one restricted to that branch, and one restricted to nothing.
///
/// Branch isolation cannot be demonstrated — or regression-tested — with a single
/// branch and a single account. <c>branch2</c> is the user who must be refused
/// another branch's data; <c>manager</c> is the user who may switch between both
/// branches, which is the only way the header's branch switcher can be exercised
/// end to end (<c>admin</c> holds no assignment rows and is therefore clinic-wide
/// as well, with the first branch only as its home/default branch).
///
/// Only runs in Development; production seeding of real staff is an operator task.
/// </summary>
public class BlueDentalBranchSeedContributor(
    IRepository<ClinicBranch, Guid> branchRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IdentityUserManager userManager,
    IGuidGenerator guidGenerator,
    IConfiguration configuration) : IDataSeedContributor, ITransientDependency
{
    public static readonly Guid SecondBranchId = new("22222222-2222-2222-2222-222222222222");

    private const string BranchUserName = "branch2";
    private const string BranchUserEmail = "branch2@bluedental.local";

    private const string ClinicWideUserName = "manager";
    private const string ClinicWideUserEmail = "manager@bluedental.local";

    public async Task SeedAsync(DataSeedContext context)
    {
        if (!IsDevelopment())
        {
            return;
        }

        await SeedSecondBranchAsync();
        await SeedBranchScopedUserAsync();
        await SeedClinicWideUserAsync();
    }

    private bool IsDevelopment() =>
        string.Equals(
            configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

    private const string SecondBranchName = "Nha Khoa Đức Hạnh Premium - Chi nhánh 2";

    private async Task SeedSecondBranchAsync()
    {
        // Corrected rather than skipped, for the reason given on the default
        // branch: a rename here has to reach a database that already has the row.
        var existing = await branchRepository.FindAsync(b => b.Id == SecondBranchId);
        if (existing is not null)
        {
            if (existing.Name != SecondBranchName)
            {
                existing.SetName(SecondBranchName);
                await branchRepository.UpdateAsync(existing, autoSave: true);
            }

            return;
        }

        var branch = new ClinicBranch(
            id: SecondBranchId,
            code: "BD-002",
            name: SecondBranchName,
            address: "45 Lê Lợi, Quận 1, TP.HCM",
            phoneNumber: "02887654321",
            email: "cn2@bluedental.vn");

        branch.SetOperatingHours(new TimeOnly(8, 0), new TimeOnly(20, 0));

        await branchRepository.InsertAsync(branch, autoSave: true);
    }

    private async Task SeedBranchScopedUserAsync()
    {
        var existing = await userManager.FindByNameAsync(BranchUserName);

        if (existing is null)
        {
            existing = new IdentityUser(guidGenerator.Create(), BranchUserName, BranchUserEmail)
            {
                Name = "Nhân viên chi nhánh 2",
            };

            var created = await userManager.CreateAsync(existing, "Branch@123456");
            if (!created.Succeeded)
            {
                return;
            }

            // Same abilities as the admin — the point of this account is the
            // branch restriction, not a reduced permission set.
            await userManager.AddToRoleAsync(existing, "admin");
        }

        // The branch claim comes from this property, not the assignment row.
        if (existing.GetProperty<System.Guid?>(BlueDentalConsts.UserClinicBranchIdPropertyName) is null)
        {
            existing.SetProperty(BlueDentalConsts.UserClinicBranchIdPropertyName, SecondBranchId);
            await userManager.UpdateAsync(existing);
        }

        var alreadyAssigned = await assignmentRepository.AnyAsync(
            a => a.StaffId == existing.Id && a.ClinicBranchId == SecondBranchId);

        if (alreadyAssigned)
        {
            return;
        }

        await assignmentRepository.InsertAsync(
            StaffBranchAssignment.Assign(
                guidGenerator.Create(),
                existing.Id,
                SecondBranchId,
                isPrimary: true),
            autoSave: true);
    }

    /// <summary>
    /// A back-office account with no <see cref="StaffBranchAssignment"/> at all —
    /// which <see cref="BranchAccessChecker"/> reads as "every branch". It still
    /// carries a home branch property, because a write with no branch named has
    /// to land somewhere.
    /// </summary>
    private async Task SeedClinicWideUserAsync()
    {
        var existing = await userManager.FindByNameAsync(ClinicWideUserName);

        if (existing is null)
        {
            existing = new IdentityUser(guidGenerator.Create(), ClinicWideUserName, ClinicWideUserEmail)
            {
                Name = "Quản lý toàn phòng khám",
            };

            var created = await userManager.CreateAsync(existing, "Manager@123456");
            if (!created.Succeeded)
            {
                return;
            }

            await userManager.AddToRoleAsync(existing, "admin");
        }

        if (existing.GetProperty<System.Guid?>(BlueDentalConsts.UserClinicBranchIdPropertyName) is null)
        {
            existing.SetProperty(
                BlueDentalConsts.UserClinicBranchIdPropertyName,
                BlueDentalDataSeedContributor.DefaultBranchId);

            await userManager.UpdateAsync(existing);
        }
    }
}
