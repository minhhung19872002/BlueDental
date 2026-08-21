using System.Threading.Tasks;

namespace BlueDental.Data;

public interface IBlueDentalDbSchemaMigrator
{
    Task MigrateAsync();
}
