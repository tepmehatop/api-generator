import { httpClient } from './http-client';

/**
 * Типы для модуля: users
 */

export interface User {
  id: number;
  email: string;
  name?: string;
  role?: Role;
}

export interface UserInput {
  email: string;
  name?: string;
}

export interface Role {
  id?: number;
  name?: string;
}

/**
 * API методы для: users
 */

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<User> {
  const url = `/users/${userId}`;
  const response = await httpClient.request({
    method: 'GET',
    url,
  });
  return response.data;
}

/**
 * Create user
 */
export async function createUser(body: UserInput): Promise<User> {
  const url = `/users`;
  const response = await httpClient.request({
    method: 'POST',
    url,
    data: body,
  });
  return response.data;
}
