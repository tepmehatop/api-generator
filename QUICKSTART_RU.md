# 🚀 Быстрый старт - OpenAPI TypeScript Generator

## 📥 Установка

```bash
# Распаковка архива
tar -xzf api-generator.tar.gz
cd api-generator

# Установка зависимостей
npm install

# Сборка проекта
npm run build
```

## 💡 Использование в автотестах Playwright

### Вариант 1: Генерация перед запуском тестов

Создайте файл `scripts/generate-api.ts`:

```typescript
import { generateApi } from '../path/to/api-generator/dist/index';
import * as path from 'path';

async function main() {
  await generateApi({
    specUrl: process.env.API_SPEC_URL || 'https://your-api.com/openapi.json',
    outputDir: path.join(__dirname, '../src/api/generated'),
    httpClient: 'axios',
    baseUrl: process.env.API_BASE_URL,
    transliterateRussian: true,
  });
}

main();
```

Добавьте в `package.json`:

```json
{
  "scripts": {
    "generate-api": "ts-node scripts/generate-api.ts",
    "pretest": "npm run generate-api"
  }
}
```

### Вариант 2: Генерация в тесте

```typescript
import { test, expect } from '@playwright/test';
import { generateApi } from '../path/to/api-generator/dist/index';

test.beforeAll(async () => {
  await generateApi({
    specUrl: 'https://your-api.com/openapi.json',
    outputDir: './src/api/generated',
  });
});

test('Тест API', async () => {
  const { getUserById } = await import('./src/api/generated/users.api');
  
  const user = await getUserById(1);
  expect(user.email).toBeTruthy();
});
```

### Вариант 3: Использование готовых функций

После генерации просто импортируйте функции:

```typescript
import { test, expect } from '@playwright/test';
import { getUserById, createUser } from './api/generated/users.api';
import { listProducts } from './api/generated/products.api';
import type { User, UserInput } from './api/generated';

test('CRUD пользователя', async () => {
  // Создание пользователя
  const newUser: UserInput = {
    email: 'test@example.com',
    name: 'Test User'
  };
  
  const created = await createUser(newUser);
  expect(created.id).toBeDefined();
  
  // Получение пользователя
  const user = await getUserById(created.id);
  expect(user.email).toBe('test@example.com');
});

test('Список продуктов', async () => {
  const products = await listProducts('electronics');
  
  expect(Array.isArray(products)).toBe(true);
  expect(products.length).toBeGreaterThan(0);
});
```

## 🎯 Примеры конфигурации

### OpenAPI 2.0 (Swagger)

```typescript
await generateApi({
  specUrl: 'https://api.example.com/swagger.json',
  outputDir: './src/api',
  httpClient: 'axios',
});
```

### OpenAPI 3.0

```typescript
await generateApi({
  specUrl: 'https://api.example.com/v3/openapi.json',
  outputDir: './src/api',
  baseUrl: process.env.API_URL,
});
```

### OpenAPI 3.1

```typescript
await generateApi({
  specUrl: './specs/openapi-3.1.json',
  outputDir: './src/api',
});
```

### С русскими тегами

```typescript
await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './src/api',
  transliterateRussian: true, // Пользователи -> polzovateli.api.ts
});
```

### Локальный файл

```typescript
await generateApi({
  specUrl: './specs/my-api.json',
  outputDir: './src/api',
});
```

## 🔧 Настройка HTTP клиента

После генерации вы можете настроить HTTP клиент:

```typescript
import { httpClient } from './api/generated/http-client';

// Добавить токен
httpClient.interceptors.request.use((config) => {
  const token = process.env.API_TOKEN;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Логирование
httpClient.interceptors.request.use((config) => {
  console.log(`→ ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

httpClient.interceptors.response.use(
  (response) => {
    console.log(`← ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`✗ ${error.response?.status} ${error.config?.url}`);
    return Promise.reject(error);
  }
);
```

## 📦 Структура сгенерированных файлов

```
src/api/generated/
├── index.ts              # Экспорт всех модулей
├── http-client.ts        # Настроенный axios клиент
├── base.types.ts         # Общие типы (если есть)
├── users.api.ts          # API для пользователей
│   ├── User (interface)
│   ├── UserInput (interface)
│   ├── getUserById()
│   └── createUser()
├── products.api.ts       # API для продуктов
│   ├── Product (interface)
│   └── listProducts()
└── orders.api.ts         # API для заказов
```

## 🎨 Работа с типами

### Импорт типов

```typescript
import type { 
  User, 
  UserInput, 
  Product,
  Order 
} from './api/generated';
```

### Валидация полей

```typescript
import type { User } from './api/generated';

test('Проверка структуры DTO', async () => {
  const user = await getUserById(1);
  
  // TypeScript проверит типы
  const requiredFields: (keyof User)[] = ['id', 'email'];
  
  for (const field of requiredFields) {
    expect(user[field]).toBeDefined();
  }
});
```

### Моки с правильными типами

```typescript
import type { User } from './api/generated';

const mockUser: User = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
};
```

## 🔄 CI/CD интеграция

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate API client
        run: npm run generate-api
        env:
          API_SPEC_URL: ${{ secrets.API_SPEC_URL }}
      
      - name: Run tests
        run: npm test
```

### GitLab CI

```yaml
test:
  image: node:18
  script:
    - npm ci
    - npm run generate-api
    - npm test
  variables:
    API_SPEC_URL: $API_SPEC_URL
```

## 🐛 Troubleshooting

### Ошибка: "Cannot find module"

Убедитесь что запустили сборку:

```bash
npm run build
```

### Ошибка при генерации

Проверьте доступность OpenAPI документа:

```bash
curl https://your-api.com/openapi.json
```

### Типы не подтягиваются

Проверьте что `outputDir` правильно указан и файлы сгенерированы.

## 📞 Поддержка

Если возникли вопросы или нашли баг, создайте issue в репозитории.

## 🎉 Готово!

Теперь вы можете использовать типобезопасный API клиент в своих Playwright тестах!
