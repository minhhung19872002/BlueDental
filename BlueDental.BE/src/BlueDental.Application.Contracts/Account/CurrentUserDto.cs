using System;
using System.Collections.Generic;

namespace BlueDental.Account;

public class CurrentUserDto
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Email { get; set; }
    public Guid? ClinicId { get; set; }
    public string? ClinicName { get; set; }
    public string? ClinicLogoUrl { get; set; }
    public string? ClinicTagline { get; set; }
    public List<string> Roles { get; set; } = [];
    public List<string> Permissions { get; set; } = [];
    public bool PasswordMustChange { get; set; }

    /// <summary>The "Bác sĩ", "Phụ tá" and "Y sĩ" ticks on the staff form.</summary>
    public bool IsDentist { get; set; }
    public bool IsAssistant { get; set; }
    public bool IsHygienist { get; set; }
}

public class ChangePasswordInput
{
    public string CurrentPassword { get; set; } = default!;
    public string NewPassword { get; set; } = default!;
}
