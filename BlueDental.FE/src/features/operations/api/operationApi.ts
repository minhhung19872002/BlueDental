import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

export interface OperationCategoryDto {
  id: string;
  clinicBranchId: string;
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
  clinicBranchId: string;
  name: string;
  department: string;
  subTab: string;
  sortOrder?: number;
}

export interface OperationArticleDto {
  id: string;
  clinicBranchId: string;
  title: string;
  content?: string;
  categoryId: string;
  department: string;
  subTab: string;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateOperationArticleDto {
  clinicBranchId: string;
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
  categories: (params: {
    clinicBranchId?: string;
    department: string;
    subTab: string;
  }): Promise<PagedResult<OperationCategoryDto>> =>
    api
      .get("/v1/app/operations/categories", { params: { ...params, maxResultCount: 100 } })
      .then((r) => r.data),
  createCategory: (data: CreateOperationCategoryDto): Promise<OperationCategoryDto> =>
    api.post("/v1/app/operations/categories", data).then((r) => r.data),
  updateCategory: (id: string, data: UpdateOperationCategoryDto): Promise<OperationCategoryDto> =>
    api.put(`/v1/app/operations/categories/${id}`, data).then((r) => r.data),
  deleteCategory: (id: string): Promise<void> =>
    api.delete(`/v1/app/operations/categories/${id}`).then((r) => r.data),

  articles: (params: {
    clinicBranchId?: string;
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
  uploadArticleImage: (clinicBranchId: string, file: File): Promise<{ id: string; url: string }> => {
    const body = new FormData();
    body.append("file", file);
    body.append("clinicBranchId", clinicBranchId);
    return api.post("/v1/app/operations/article-images", body).then((r) => r.data);
  },
  deleteArticle: (id: string): Promise<void> =>
    api.delete(`/v1/app/operations/articles/${id}`).then((r) => r.data),
};

/** Lets a caller switch a query off where its sub-tab has nothing to ask for. */
interface QueryOptions {
  enabled?: boolean;
}

export function useOperationCategories(
  department: string,
  subTab: string,
  options: QueryOptions = {},
) {
  // Follows the header's branch; undefined means every branch this account sees.
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: ["operation-categories", clinicBranchId, department, subTab],
    queryFn: () => operationApi.categories({ clinicBranchId, department, subTab }),
    enabled: (options.enabled ?? true) && Boolean(department && subTab),
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
  options: QueryOptions = {},
) {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: ["operation-articles", clinicBranchId, department, subTab, params],
    queryFn: () => operationApi.articles({ clinicBranchId, department, subTab, ...params }),
    enabled: (options.enabled ?? true) && Boolean(department && subTab),
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

/**
 * Puts an image the user dropped into an article somewhere the row does not
 * have to carry it, and hands back the link the body keeps.
 */
export function useUploadOperationArticleImage() {
  return useMutation({
    mutationFn: ({ clinicBranchId, file }: { clinicBranchId: string; file: File }) =>
      operationApi.uploadArticleImage(clinicBranchId, file),
  });
}
