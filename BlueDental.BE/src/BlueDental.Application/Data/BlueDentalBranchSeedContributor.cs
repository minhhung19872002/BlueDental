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
/// Seeds a second clinic branch and a staff account restricted to it.
///
/// Branch isolation cannot be demonstrated — or regression-tested — with a single
/// branch and a single clinic-wide account. This gives the acceptance suite a
/// user who must be refused another branch's data.
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

    public async Task SeedAsync(DataSeedContext context)
    {
        if (!IsDevelopment())
        {
            return;
        }

        await SeedSecondBranchAsync();
        await SeedBranchScopedUserAsync();
    }

    private bool IsDevelopment() =>
        string.Equals(
            configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

    private async Task SeedSecondBranchAsync()
    {
        if (await branchRepository.AnyAsync(b => b.Id == SecondBranchId))
        {
            return;
        }

        var branch = new ClinicBranch(
            id: SecondBranchId,
            code: "BD-002",
            name: "BlueDental - Chi nhánh 2",
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
}
