export interface GetAllResponse<T = any> {
  docsCount?: number;
  limit?: number;
  pagesCount?: number;
  currentPage?: number | undefined;
  result: T[];
}
