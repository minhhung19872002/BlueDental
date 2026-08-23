import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** Matches BlueDental.Operations.OperationsDepartment. */
export const OPERATIONS_DEPARTMENT = {
  Overview: 1,
  Assistant: 2,
  Reception: 3,
  Cskh: 4,
  Marketing: 5,
  Security: 6,
  Treatment: 7,
  Finance: 8,
} as const;
export type OperationsDepartment =
  (typeof OPERATIONS_DEPARTMENT)[keyof typeof OPERATIONS_DEPARTMENT];

/** Tab key on the page -> department code on the server. */
export const DEPARTMENT_BY_TAB: Record<string, OperationsDepartment> = {
  overview: OPERATIONS_DEPARTMENT.Overview,
  assistant: OPERATIONS_DEPARTMENT.Assistant,
  reception: OPERATIONS_DEPARTMENT.Reception,
  cskh: OPERATIONS_DEPARTMENT.Cskh,
  marketing: OPERATIONS_DEPARTMENT.Marketing,
  security: OPERATIONS_DEPARTMENT.Security,
  treatment: OPERATIONS_DEPARTMENT.Treatment,
  finance: OPERATIONS_DEPARTMENT.Finance,
};

/** Matches BlueDental.Operations.OperationsSection. */
export const OPERATIONS_SECTION = { Home: 1, Process: 2 } as const;
export type OperationsSection = (typeof OPERATIONS_SECTION)[keyof typeof OPERATIONS_SECTION];

/** Matches BlueDental.Operations.OperationsTaskStatus. */
export const TASK_STATUS = { Todo: 1, InProgress: 2, Done: 3, Cancelled: 4 } as const;
export type OperationsTaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_STATUS_CONFIG: Record<OperationsTaskStatus, { label: string; color: string }> = {
  [TASK_STATUS.Todo]: { label: "Chưa làm", color: "default" },
  [TASK_STATUS.InProgress]: { label: "Đang làm", color: "processing" },
  [TASK_STATUS.Done]: { label: "Hoàn thành", color: "green" },
  [TASK_STATUS.Cancelled]: { label: "Đã huỷ", color: "red" },
};

export interface OperationsArticleDto {
  id: string;
  clinicBranchId: string;
  department: OperationsDepartment;
  section: OperationsSection;
  title: string;
  summary: string | null;
  content: string | null;
  sortOrder: number;
  isPublished: boolean;
  isPinned: boolean;
  publishedAt: string | null;
  authorName: string | null;
  creationTime: string;
}

export interface OperationsTaskDto {
  id: string;
  clinicBranchId: string;
  department: OperationsDepartment;
  title: string;
  description: string | null;
  assigneeStaffId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  status: OperationsTaskStatus;
  isOverdue: boolean;
  completedAt: string | null;
  cancellationReason: string | null;
  creationTime: string;
}

export interface OperationsTaskStatsDto {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
}

export interface ArticleListInput {
  clinicBranchId?: string;
  department?: OperationsDepartment;
  section?: OperationsSection;
  isPublished?: boolean;
  filter?: string;
  maxResultCount?: number;
}

export interface TaskListInput {
  clinicBranchId?: string;
  department?: OperationsDepartment;
  status?: OperationsTaskStatus;
  overdueOnly?: boolean;
  filter?: string;
  maxResultCount?: number;
}

const ARTICLES = "/v1/app/operations-articles";
const TASKS = "/v1/app/operations-tasks";

const operationsApi = {
  articles: (params: ArticleListInput): Promise<PagedResult<OperationsArticleDto>> =>
    api.get<PagedResult<OperationsArticleDto>>(ARTICLES, { params }).then((r) => r.data),

  createArticle: (input: {
    clinicBranchId: string;
    department: OperationsDepartment;
    section: OperationsSection;
    title: string;
    summary?: string;
    content?: string;
  }): Promise<OperationsArticleDto> =>
    api.post<OperationsArticleDto>(ARTICLES, input).then((r) => r.data),

  publishArticle: (id: string): Promise<OperationsArticleDto> =>
    api.post<OperationsArticleDto>(`${ARTICLES}/${id}/publish`).then((r) => r.data),

  unpublishArticle: (id: string): Promise<OperationsArticleDto> =>
    api.post<OperationsArticleDto>(`${ARTICLES}/${id}/unpublish`).then((r) => r.data),

  deleteArticle: (id: string): Promise<void> =>
    api.delete(`${ARTICLES}/${id}`).then(() => undefined),

  tasks: (params: TaskListInput): Promise<PagedResult<OperationsTaskDto>> =>
    api.get<PagedResult<OperationsTaskDto>>(TASKS, { params }).then((r) => r.data),

  taskStats: (params: TaskListInput): Promise<OperationsTaskStatsDto> =>
    api.get<OperationsTaskStatsDto>(`${TASKS}/stats`, { params }).then((r) => r.data),

  createTask: (input: {
    clinicBranchId: string;
    department: OperationsDepartment;
    title: string;
    description?: string;
    dueDate?: string;
  }): Promise<OperationsTaskDto> => api.post<OperationsTaskDto>(TASKS, input).then((r) => r.data),

  startTask: (id: string): Promise<OperationsTaskDto> =>
    api.post<OperationsTaskDto>(`${TASKS}/${id}/start`).then((r) => r.data),

  completeTask: (id: string): Promise<OperationsTaskDto> =>
    api.post<OperationsTaskDto>(`${TASKS}/${id}/complete`).then((r) => r.data),

  deleteTask: (id: string): Promise<void> => api.delete(`${TASKS}/${id}`).then(() => undefined),
};

export const operationsKeys = {
  all: ["operations"] as const,
  articles: (params: ArticleListInput) => [...operationsKeys.all, "articles", params] as const,
  tasks: (params: TaskListInput) => [...operationsKeys.all, "tasks", params] as const,
  taskStats: (params: TaskListInput) => [...operationsKeys.all, "task-stats", params] as const,
};

export function useOperationsArticles(params: ArticleListInput, enabled = true) {
  return useQuery({
    queryKey: operationsKeys.articles(params),
    queryFn: () => operationsApi.articles(params),
    enabled,
  });
}

export function useOperationsTasks(params: TaskListInput, enabled = true) {
  return useQuery({
    queryKey: operationsKeys.tasks(params),
    queryFn: () => operationsApi.tasks(params),
    enabled,
  });
}

export function useOperationsTaskStats(params: TaskListInput, enabled = true) {
  return useQuery({
    queryKey: operationsKeys.taskStats(params),
    queryFn: () => operationsApi.taskStats(params),
    enabled,
  });
}

function useOperationsMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: operationsKeys.all });
    },
  });
}

export function useCreateArticle() {
  return useOperationsMutation(operationsApi.createArticle);
}

export function usePublishArticle() {
  return useOperationsMutation((id: string) => operationsApi.publishArticle(id));
}

export function useUnpublishArticle() {
  return useOperationsMutation((id: string) => operationsApi.unpublishArticle(id));
}

export function useDeleteArticle() {
  return useOperationsMutation((id: string) => operationsApi.deleteArticle(id));
}

export function useCreateTask() {
  return useOperationsMutation(operationsApi.createTask);
}

export function useStartTask() {
  return useOperationsMutation((id: string) => operationsApi.startTask(id));
}

export function useCompleteTask() {
  return useOperationsMutation((id: string) => operationsApi.completeTask(id));
}

export function useDeleteTask() {
  return useOperationsMutation((id: string) => operationsApi.deleteTask(id));
}
