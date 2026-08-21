/** Standard paged list response from the API */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

/** Common lookup item used in dropdowns */
export interface LookupItem {
  id: string;
  name: string;
}

/** Base entity with audit fields */
export interface AuditedEntity {
  id: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Pagination params for API requests */
export interface PaginationParams {
  skipCount?: number;
  maxResultCount?: number;
}
