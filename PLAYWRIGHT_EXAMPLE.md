# 📚 Полный пример интеграции с Playwright

## Структура проекта

```
my-playwright-tests/
├── package.json
├── playwright.config.ts
├── api-generator/              # Ваш генератор
│   ├── src/
│   ├── dist/
│   └── package.json
├── scripts/
│   └── generate-api.ts         # Скрипт генерации
├── src/
│   ├── api/
│   │   └── generated/          # Сгенерированные файлы
│   │       ├── index.ts
│   │       ├── http-client.ts
│   │       ├── users.api.ts
│   │       └── products.api.ts
│   └── tests/
│       ├── api/
│       │   ├── users.spec.ts
│       │   └── products.spec.ts
│       └── fixtures/
│           └── api.fixture.ts
└── .env
```

## Файл: scripts/generate-api.ts

```typescript
import { generateApi } from '../api-generator/dist/index';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🔧 Генерация API клиента...');
  
  await generateApi({
    // URL можно брать из переменных окружения
    specUrl: process.env.API_SPEC_URL || 'https://api.example.com/openapi.json',
    
    // Путь для выгрузки
    outputDir: path.join(__dirname, '../src/api/generated'),
    
    // HTTP клиент
    httpClient: 'axios',
    
    // Базовый URL для запросов
    baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
    
    // Опции
    generateErrorHandlers: true,
    generateTypes: true,
    transliterateRussian: true,
  });
  
  console.log('✅ Готово!');
}

main().catch(console.error);
```

## Файл: package.json

```json
{
  "name": "my-playwright-tests",
  "version": "1.0.0",
  "scripts": {
    "generate-api": "ts-node scripts/generate-api.ts",
    "test": "playwright test",
    "test:api": "playwright test src/tests/api",
    "test:with-gen": "npm run generate-api && npm test",
    "pretest": "npm run generate-api"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "axios": "^1.6.0",
    "dotenv": "^16.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0"
  }
}
```

## Файл: .env

```env
API_SPEC_URL=https://api.example.com/openapi.json
API_BASE_URL=https://api.example.com/v1
API_TOKEN=your-api-token-here
```

## Файл: playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  
  // Тайм-ауты
  timeout: 30000,
  
  // Параллельность
  workers: 4,
  
  use: {
    // Базовый URL для UI тестов
    baseURL: 'https://your-app.com',
    
    // Трейсы
    trace: 'on-first-retry',
    
    // Скриншоты
    screenshot: 'only-on-failure',
  },
  
  projects: [
    {
      name: 'API Tests',
      testMatch: /.*\.api\.spec\.ts$/,
    },
    {
      name: 'UI Tests',
      testMatch: /.*\.ui\.spec\.ts$/,
    },
  ],
});
```

## Файл: src/tests/fixtures/api.fixture.ts

```typescript
import { test as base } from '@playwright/test';
import * as UsersAPI from '../../api/generated/users.api';
import * as ProductsAPI from '../../api/generated/products.api';
import { httpClient } from '../../api/generated/http-client';

// Типы для фикстур
type ApiFixtures = {
  usersApi: typeof UsersAPI;
  productsApi: typeof ProductsAPI;
};

// Расширяем базовый тест
export const test = base.extend<ApiFixtures>({
  // Фикстура для Users API
  usersApi: async ({}, use) => {
    // Настройка перед использованием
    const token = process.env.API_TOKEN;
    if (token) {
      httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    await use(UsersAPI);
    
    // Очистка после использования (если нужна)
  },
  
  // Фикстура для Products API
  productsApi: async ({}, use) => {
    await use(ProductsAPI);
  },
});

export { expect } from '@playwright/test';
```

## Файл: src/tests/api/users.spec.ts

```typescript
import { test, expect } from '../fixtures/api.fixture';
import type { User, UserInput } from '../../api/generated';

test.describe('Users API', () => {
  
  test('Создание пользователя', async ({ usersApi }) => {
    const newUser: UserInput = {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
    };
    
    const created = await usersApi.createUser(newUser);
    
    expect(created).toBeDefined();
    expect(created.id).toBeGreaterThan(0);
    expect(created.email).toBe(newUser.email);
    expect(created.name).toBe(newUser.name);
  });
  
  test('Получение пользователя по ID', async ({ usersApi }) => {
    // Сначала создаем
    const newUser: UserInput = {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
    };
    
    const created = await usersApi.createUser(newUser);
    
    // Теперь получаем
    const user = await usersApi.getUserById(created.id);
    
    expect(user.id).toBe(created.id);
    expect(user.email).toBe(created.email);
  });
  
  test('Обработка ошибки 404', async ({ usersApi }) => {
    try {
      await usersApi.getUserById(999999999);
      // Если не выбросилась ошибка - тест провален
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }
  });
  
  test('Валидация структуры User DTO', async ({ usersApi }) => {
    const newUser: UserInput = {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
    };
    
    const user = await usersApi.createUser(newUser);
    
    // Проверяем что все поля присутствуют
    expect(typeof user.id).toBe('number');
    expect(typeof user.email).toBe('string');
    expect(typeof user.name).toBe('string');
    
    // Проверяем формат email
    expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
  
});
```

## Файл: src/tests/api/products.spec.ts

```typescript
import { test, expect } from '../fixtures/api.fixture';
import type { Product } from '../../api/generated';

test.describe('Products API', () => {
  
  test('Получение списка продуктов', async ({ productsApi }) => {
    const products = await productsApi.listProducts();
    
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    
    // Проверяем структуру первого продукта
    const firstProduct = products[0];
    expect(firstProduct.id).toBeDefined();
    expect(firstProduct.name).toBeDefined();
    expect(firstProduct.price).toBeDefined();
  });
  
  test('Фильтрация по категории', async ({ productsApi }) => {
    const category = 'electronics';
    const products = await productsApi.listProducts(category);
    
    expect(Array.isArray(products)).toBe(true);
    
    // Все продукты должны быть из указанной категории
    for (const product of products) {
      expect(product.category).toBe(category);
    }
  });
  
  test('Пустой список при несуществующей категории', async ({ productsApi }) => {
    const products = await productsApi.listProducts('nonexistent-category');
    
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBe(0);
  });
  
  test.describe('Параллельные запросы', () => {
    test('Множественные запросы одновременно', async ({ productsApi }) => {
      const categories = ['electronics', 'books', 'clothing'];
      
      // Запускаем все запросы параллельно
      const results = await Promise.all(
        categories.map(cat => productsApi.listProducts(cat))
      );
      
      // Проверяем что все запросы успешны
      expect(results.length).toBe(categories.length);
      
      for (let i = 0; i < results.length; i++) {
        expect(Array.isArray(results[i])).toBe(true);
      }
    });
  });
  
});
```

## Файл: src/tests/api/integration.spec.ts

```typescript
import { test, expect } from '../fixtures/api.fixture';

test.describe('Интеграционные тесты', () => {
  
  test('Полный сценарий: Пользователь покупает продукт', async ({ 
    usersApi, 
    productsApi 
  }) => {
    // 1. Создаем пользователя
    const newUser = {
      email: `buyer-${Date.now()}@example.com`,
      name: 'Test Buyer',
    };
    
    const user = await usersApi.createUser(newUser);
    expect(user.id).toBeDefined();
    
    // 2. Получаем список продуктов
    const products = await productsApi.listProducts('electronics');
    expect(products.length).toBeGreaterThan(0);
    
    const selectedProduct = products[0];
    
    // 3. Проверяем что продукт доступен
    expect(selectedProduct.id).toBeDefined();
    expect(selectedProduct.price).toBeGreaterThan(0);
    
    console.log(`
      ✅ Сценарий выполнен:
      - Пользователь: ${user.name} (${user.email})
      - Продукт: ${selectedProduct.name}
      - Цена: $${selectedProduct.price}
    `);
  });
  
  test('Проверка консистентности данных', async ({ usersApi }) => {
    // Создаем пользователя
    const newUser = {
      email: `consistency-${Date.now()}@example.com`,
      name: 'Consistency Test',
    };
    
    const created = await usersApi.createUser(newUser);
    
    // Получаем его же через GET
    const fetched = await usersApi.getUserById(created.id);
    
    // Данные должны совпадать
    expect(fetched.id).toBe(created.id);
    expect(fetched.email).toBe(created.email);
    expect(fetched.name).toBe(created.name);
  });
  
});
```

## Запуск тестов

```bash
# Сгенерировать API и запустить все тесты
npm run test:with-gen

# Только API тесты
npm run test:api

# Конкретный файл
npx playwright test src/tests/api/users.spec.ts

# С отчетом
npx playwright test --reporter=html

# В UI режиме
npx playwright test --ui
```

## Дополнительные возможности

### Логирование API запросов

```typescript
// В src/api/generated/http-client.ts добавьте:

httpClient.interceptors.request.use((config) => {
  console.log(`→ ${config.method?.toUpperCase()} ${config.url}`, {
    params: config.params,
    data: config.data,
  });
  return config;
});

httpClient.interceptors.response.use(
  (response) => {
    console.log(`← ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`✗ ${error.response?.status} ${error.config?.url}`, {
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);
```

### Моки для тестов

```typescript
import { test, expect } from '@playwright/test';
import type { User } from '../../api/generated';

// Создаем фабрику для мок-данных
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    ...overrides,
  };
}

test('Использование моков', async () => {
  const mockUser = createMockUser({ email: 'custom@example.com' });
  
  expect(mockUser.email).toBe('custom@example.com');
  expect(mockUser.name).toBe('Test User');
});
```

### Retry стратегия

```typescript
// В playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  
  use: {
    // Настройки для axios можно добавить через env
    extraHTTPHeaders: {
      'X-Test-Run-Id': process.env.TEST_RUN_ID || 'local',
    },
  },
});
```

Готово! Теперь у вас есть полноценный пример интеграции генератора с Playwright тестами. 🎉
