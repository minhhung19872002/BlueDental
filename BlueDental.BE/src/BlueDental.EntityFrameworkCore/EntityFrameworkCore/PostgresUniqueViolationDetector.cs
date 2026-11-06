using System;
using BlueDental.Data;
using Npgsql;
using Volo.Abp.DependencyInjection;

namespace BlueDental.EntityFrameworkCore;

/// <summary>PostgreSQL's unique_violation (23505), however deep EF Core and ABP wrapped it.</summary>
public class PostgresUniqueViolationDetector : IUniqueViolationDetector, ISingletonDependency
{
    public bool IsUniqueViolation(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                return true;
            }
        }

        return false;
    }
}
