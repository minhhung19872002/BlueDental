using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Operations;

public interface IOperationAppService : IApplicationService
{
    Task<PagedResultDto<OperationCategoryDto>> GetCategoryListAsync(GetOperationListInput input);
    Task<OperationCategoryDto> CreateCategoryAsync(CreateOperationCategoryDto input);
    Task<OperationCategoryDto> UpdateCategoryAsync(Guid id, UpdateOperationCategoryDto input);
    Task DeleteCategoryAsync(Guid id);

    Task<PagedResultDto<OperationArticleDto>> GetArticleListAsync(GetOperationListInput input);
    Task<OperationArticleDto> CreateArticleAsync(CreateOperationArticleDto input);
    Task<OperationArticleDto> UpdateArticleAsync(Guid id, UpdateOperationArticleDto input);
    Task DeleteArticleAsync(Guid id);
}
