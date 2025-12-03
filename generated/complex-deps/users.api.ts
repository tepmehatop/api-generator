import { httpClient } from './http-client';

/**
 * Типы для модуля: users
 */

export interface UserListResponse {
  users?: User[];
  pagination?: PageMetadata;
}

export interface User {
  id?: number;
  name?: string;
  role?: Role;
}

export interface PageMetadata {
  page?: number;
  total?: number;
  sortBy?: SortObject;
}

export interface SortObject {
  field?: string;
  order?: 'asc' | 'desc';
}

export interface Role {
  id?: number;
  name?: string;
}

/**
 * API методы для: users
 */

/**
 * No Description
 *
 * @tags users
 * @name listUsers
 * @request GET:/users
 * @response '200' 'UserListResponse' Success
 */
export async function listUsers(): Promise<UserListResponse> {
  const response = await httpClient.request({
    method: 'GET',
    url: `/users`,
  });
  return response.data;
}
