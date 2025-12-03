import { httpClient } from './http-client';

/**
 * Типы для модуля: test
 */

export interface Item {
  id?: number;
  /** JSON-LD identifier */
  '@id'?: string;
  '@type'?: string;
  name?: string;
  'meta-data'?: string;
  pagination?: PageMetadata;
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

/**
 * API методы для: test
 */

/**
 * No Description
 *
 * @tags test
 * @name getItems
 * @request GET:/items
 * @response '200' 'Item[]' Success
 */
export async function getItems(): Promise<Item[]> {
  const response = await httpClient.request({
    method: 'GET',
    url: `/items`,
  });
  return response.data;
}
