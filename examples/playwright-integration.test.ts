/**
 * Пример использования сгенерированного API в Playwright тестах
 */

import { test, expect } from '@playwright/test';
import { generateApi } from '../src/index';
import * as path from 'path';

// =============================================================================
// SETUP: Генерация API перед тестами
// =============================================================================

test.beforeAll(async () => {
  console.log('🔧 Генерация API клиента перед запуском тестов...');
  
  await generateApi({
    specUrl: 'https://petstore.swagger.io/v2/swagger.json',
    outputDir: path.join(__dirname, './generated-api'),
    httpClient: 'axios',
    baseUrl: 'https://petstore.swagger.io/v2',
  });
  
  console.log('✅ API клиент сгенерирован');
});

// =============================================================================
// ТЕСТЫ
// =============================================================================

test.describe('Petstore API Tests', () => {
  
  test('Пример 1: Создание и получение питомца', async () => {
    // Динамический импорт после генерации
    const { addPet, getPetById } = await import('./generated-api/pet.api');
    
    // Создаем питомца
    const newPet = {
      id: Date.now(),
      name: 'Test Doggie',
      photoUrls: ['https://example.com/photo.jpg'],
      status: 'available' as const,
    };
    
    // Вызываем API
    await addPet(newPet);
    
    // Получаем питомца
    const pet = await getPetById(newPet.id);
    
    // Проверки
    expect(pet).toBeDefined();
    expect(pet.name).toBe('Test Doggie');
    expect(pet.status).toBe('available');
  });
  
  test('Пример 2: Работа с типами DTO', async () => {
    const { Pet } = await import('./generated-api/pet.api');
    const { getPetById } = await import('./generated-api/pet.api');
    
    const pet = await getPetById(1);
    
    // TypeScript обеспечивает типобезопасность
    expect(pet.name).toBeDefined();
    expect(typeof pet.name).toBe('string');
    
    // Проверяем структуру DTO
    const requiredFields: (keyof typeof pet)[] = ['name', 'photoUrls'];
    for (const field of requiredFields) {
      expect(pet[field]).toBeDefined();
    }
  });
  
  test('Пример 3: Поиск питомцев по статусу', async () => {
    const { findPetsByStatus } = await import('./generated-api/pet.api');
    
    const pets = await findPetsByStatus('available');
    
    expect(Array.isArray(pets)).toBe(true);
    expect(pets.length).toBeGreaterThan(0);
    
    // Проверяем что все питомцы имеют статус available
    for (const pet of pets) {
      expect(pet.status).toBe('available');
    }
  });
  
  test('Пример 4: Работа со Store API', async () => {
    const { getInventory } = await import('./generated-api/store.api');
    
    const inventory = await getInventory();
    
    expect(inventory).toBeDefined();
    expect(typeof inventory).toBe('object');
  });
  
  test('Пример 5: Обработка ошибок', async () => {
    const { getPetById } = await import('./generated-api/pet.api');
    
    // Пытаемся получить несуществующего питомца
    try {
      await getPetById(999999999);
      // Если не выбросилась ошибка, тест провален
      expect(true).toBe(false);
    } catch (error: any) {
      // Проверяем что получили ошибку 404
      expect(error.response?.status).toBe(404);
    }
  });
  
});

// =============================================================================
// ADVANCED: Использование с fixtures
// =============================================================================

type ApiFixtures = {
  petApi: typeof import('./generated-api/pet.api');
  storeApi: typeof import('./generated-api/store.api');
  userApi: typeof import('./generated-api/user.api');
};

const apiTest = test.extend<ApiFixtures>({
  petApi: async ({}, use) => {
    const api = await import('./generated-api/pet.api');
    await use(api);
  },
  
  storeApi: async ({}, use) => {
    const api = await import('./generated-api/store.api');
    await use(api);
  },
  
  userApi: async ({}, use) => {
    const api = await import('./generated-api/user.api');
    await use(api);
  },
});

apiTest.describe('Tests with API Fixtures', () => {
  
  apiTest('Использование API через fixtures', async ({ petApi, storeApi }) => {
    // Теперь можно использовать API напрямую
    const pets = await petApi.findPetsByStatus('available');
    const inventory = await storeApi.getInventory();
    
    expect(pets.length).toBeGreaterThan(0);
    expect(inventory).toBeDefined();
  });
  
  apiTest('Создание полного сценария', async ({ petApi, userApi }) => {
    // 1. Создаем пользователя
    await userApi.createUser({
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'test123',
      phone: '1234567890',
      userStatus: 1,
    });
    
    // 2. Создаем питомца
    const petId = Date.now();
    await petApi.addPet({
      id: petId,
      name: 'User Pet',
      photoUrls: [],
      status: 'available',
    });
    
    // 3. Получаем питомца
    const pet = await petApi.getPetById(petId);
    
    // 4. Проверяем
    expect(pet.name).toBe('User Pet');
  });
  
});

// =============================================================================
// DATA-DRIVEN TESTS: Тесты на основе данных
// =============================================================================

test.describe('Data-Driven API Tests', () => {
  
  const testCases = [
    { status: 'available', expectedCount: 1 },
    { status: 'pending', expectedCount: 0 },
    { status: 'sold', expectedCount: 0 },
  ] as const;
  
  for (const testCase of testCases) {
    test(`Поиск питомцев со статусом: ${testCase.status}`, async () => {
      const { findPetsByStatus } = await import('./generated-api/pet.api');
      
      const pets = await findPetsByStatus(testCase.status);
      
      expect(Array.isArray(pets)).toBe(true);
      expect(pets.length).toBeGreaterThanOrEqual(testCase.expectedCount);
    });
  }
  
});

// =============================================================================
// PERFORMANCE TESTS: Тесты производительности
// =============================================================================

test.describe('Performance Tests', () => {
  
  test('Параллельные запросы к API', async () => {
    const { getPetById } = await import('./generated-api/pet.api');
    
    const startTime = Date.now();
    
    // Запускаем 10 параллельных запросов
    const promises = Array.from({ length: 10 }, (_, i) => 
      getPetById(i + 1).catch(() => null)
    );
    
    const results = await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️ Выполнено 10 запросов за ${duration}ms`);
    
    // Проверяем что хотя бы часть запросов успешна
    const successfulRequests = results.filter(r => r !== null);
    expect(successfulRequests.length).toBeGreaterThan(0);
  });
  
});
