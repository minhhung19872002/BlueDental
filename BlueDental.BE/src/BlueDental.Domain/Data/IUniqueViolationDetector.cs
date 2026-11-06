using System;

namespace BlueDental.Data;

/// <summary>
/// Tells whether a save failed on a unique index. Lets the domain resolve a
/// lost race ("someone created it a moment earlier") without knowing the
/// database provider.
/// </summary>
public interface IUniqueViolationDetector
{
    bool IsUniqueViolation(Exception exception);
}
