import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface OperationCategoryDto {
  id: string;
  name: string;
  department: string;
  subTab: string;
  sortOrder: number;
  creationTime: string;
}

export interface UpdateOperationCategoryDto {
  name: string;
  sortOrder?: number;
}

export interface CreateOperationCategoryDto {
  name: string;
  department: string;
  subTab: string;
  sortOrder?: number;
}

export interface OperationArticleDto {
  id: string;
  title: string;
  content?: string;
  categoryId: string;
  department: string;
  subTab: string;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateOperationArticleDto {
  title: string;
  content?: string;
  categoryId: string;
  department: string;
  subTab: string;
}

export interface UpdateOperationArticleDto {
  title: string;
  content?: string;
}

const operationApi = {
  categories: (params: { department: string; subTab: string }): Promise<PagedResult<OperationCategoryDto>> =>
    api.get("/v1/app/operations/categories", { params: { ...params, maxResultCount: 100 } }).then((r) => r.data),
  createCategory: (data: CreateOperationCategoryDto): Promise<OperationCategoryDto> =>
    api.post("/v1/app/operations/categories", data).then((r) => r.data),
  updateCategory: (id: string, data: UpdateOperationCategoryDto): Promise<OperationCategoryDto> =>
    api.put(`/v1/app/operations/categories/${id}`, data).then((r) => r.data),
  deleteCategory: (id: string): Promise<void> =>
    api.delete(`/v1/app/operations/categories/${id}`).then((r) => r.data),

  articles: (params: {
    department: string;
    subTab: string;
    categoryId?: string;
    filter?: string;
    skipCount: number;
    maxResultCount: number;
  }): Promise<PagedResult<OperationArticleDto>> =>
    api.get("/v1/app/operations/articles", { params }).then((r) => r.data),
  createArticle: (data: CreateOperationArticleDto): Promise<OperationArticleDto> =>
    api.post("/v1/app/operations/articles", data).then((r) => r.data),
  updateArticle: (id: string, data: UpdateOperationArticleDto): Promise<OperationArticleDto> =>
    api.put(`/v1/app/operations/articles/${id}`, data).then((r) => r.data),
  deleteArticle: (id: string): Promise<void> =>
    api.delete(`/v1/app/operations/articles/${id}`).then((r) => r.data),
};

export function useOperationCategories(department: string, subTab: string) {
  return useQuery({
    queryKey: ["operation-categories", department, subTab],
    queryFn: () => operationApi.categories({ department, subTab }),
    enabled: Boolean(department && subTab),
  });
}

export function useCreateOperationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOperationCategoryDto) => operationApi.createCategory(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["operation-categories"] });
      void qc.invalidateQueries({ queryKey: ["operation-articles"] });
    },
  });
}

export function useUpdateOperationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOperationCategoryDto }) =>
      operationApi.updateCategory(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["operation-categories"] });
      void qc.invalidateQueries({ queryKey: ["operation-articles"] });
    },
  });
}

export function useDeleteOperationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => operationApi.deleteCategory(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["operation-categories"] });
      void qc.invalidateQueries({ queryKey: ["operation-articles"] });
    },
  });
}

export interface ArticleListParams {
  categoryId?: string;
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

export function useOperationArticles(
  department: string,
  subTab: string,
  params: ArticleListParams,
) {
  return useQuery({
    queryKey: ["operation-articles", department, subTab, params],
    queryFn: () => operationApi.articles({ department, subTab, ...params }),
    enabled: Boolean(department && subTab),
  });
}

export function useCreateOperationArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOperationArticleDto) => operationApi.createArticle(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operation-articles"] }),
  });
}

export function useUpdateOperationArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOperationArticleDto }) => operationApi.updateArticle(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operation-articles"] }),
  });
}

export function useDeleteOperationArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => operationApi.deleteArticle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operation-articles"] }),
  });
}
