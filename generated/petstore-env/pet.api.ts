import { httpClient } from './http-client';

/**
 * Типы для модуля: pet
 */

export interface ApiResponse {
  code?: number;
  type?: string;
  message?: string;
}

export interface Pet {
  id?: number;
  category?: Category;
  name: string;
  photoUrls: string[];
  tags?: Tag[];
  /** pet status in the store */
  status?: 'available' | 'pending' | 'sold';
}

export interface Category {
  id?: number;
  name?: string;
}

export interface Tag {
  id?: number;
  name?: string;
}

/**
 * API методы для: pet
 */

/**
 * uploads an image
 *
 * @tags pet
 * @name uploadFile
 * @request POST:/pet/{petId}/uploadImage
 * @response '200' 'ApiResponse' successful operation
 */
export async function uploadFile(petId: number): Promise<ApiResponse> {
  const response = await httpClient.request({
    method: 'POST',
    url: `/pet/${petId}/uploadImage`,
  });
  return response.data;
}

/**
 * Add a new pet to the store
 *
 * @tags pet
 * @name addPet
 * @request POST:/pet
 * @response '405' 'void' Invalid input
 */
export async function addPet(body: Pet): Promise<void> {
  const response = await httpClient.request({
    method: 'POST',
    url: `/pet`,
    data: body,
  });
  return response.data;
}

/**
 * Update an existing pet
 *
 * @tags pet
 * @name updatePet
 * @request PUT:/pet
 * @response '400' 'void' Invalid ID supplied
 * @response '404' 'void' Pet not found
 * @response '405' 'void' Validation exception
 */
export async function updatePet(body: Pet): Promise<void> {
  const response = await httpClient.request({
    method: 'PUT',
    url: `/pet`,
    data: body,
  });
  return response.data;
}

/**
 * Finds Pets by status
 *
 * @tags pet
 * @name findPetsByStatus
 * @request GET:/pet/findByStatus
 * @response '200' 'Pet[]' successful operation
 * @response '400' 'void' Invalid status value
 */
export async function findPetsByStatus(status: 'available' | 'pending' | 'sold'[]): Promise<Pet[]> {
  const response = await httpClient.request({
    method: 'GET',
    url: `/pet/findByStatus`,
    params: {
      status: status,
    },
  });
  return response.data;
}

/**
 * Find pet by ID
 *
 * @tags pet
 * @name getPetById
 * @request GET:/pet/{petId}
 * @response '200' 'Pet' successful operation
 * @response '400' 'void' Invalid ID supplied
 * @response '404' 'void' Pet not found
 */
export async function getPetById(petId: number): Promise<Pet> {
  const response = await httpClient.request({
    method: 'GET',
    url: `/pet/${petId}`,
  });
  return response.data;
}

/**
 * Deletes a pet
 *
 * @tags pet
 * @name deletePet
 * @request DELETE:/pet/{petId}
 * @response '400' 'void' Invalid ID supplied
 * @response '404' 'void' Pet not found
 */
export async function deletePet(apiKey?: string, petId: number): Promise<void> {
  const response = await httpClient.request({
    method: 'DELETE',
    url: `/pet/${petId}`,
    headers: {
      'api_key': apiKey,
    },
  });
  return response.data;
}
