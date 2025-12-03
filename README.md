# OpenAPI TypeScript Generator

Продвинутый генератор TypeScript API клиента из OpenAPI спецификаций для использования в автотестах Playwright.

## ✨ Особенности

- 🚀 **Поддержка OpenAPI 2.0, 3.0 и 3.1** - работает с любой версией спецификации
- 📦 **Модульная структура** - отдельный файл для каждого тега
- 🔤 **Транслитерация** - автоматическое преобразование русских названий в английские
- 🎯 **Умное разделение типов** - базовые DTO в отдельном файле, специфичные - в файлах тегов
- 💪 **Type-safe** - полная типизация для TypeScript
- 🔌 **Axios из коробки** - готовый HTTP клиент с обработкой ошибок
- 🎨 **Чистый код** - читаемый и поддерживаемый сгенерированный код

## 📦 Установка

```bash
npm install --save-dev openapi-typescript-generator
```

Или используйте локально в проекте:

```bash
# Клонируйте репозиторий
git clone <repo-url>
cd api-generator

# Установите зависимости
npm install

# Соберите проект
npm run build
```

## 🚀 Быстрый старт

### Базовое использование

```typescript
import { generateApi } from 'openapi-typescript-generator';

await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './src/api/generated',
});
```

### Полная конфигурация

```typescript
await generateApi({
  // URL или путь к OpenAPI документу
  specUrl: 'https://api.example.com/openapi.json',
  
  // Путь для выгрузки сгенерированных файлов
  outputDir: './src/api/generated',
  
  // HTTP клиент (пока поддерживается только axios)
  httpClient: 'axios',
  
  // Базовый URL для API запросов
  baseUrl: 'https://api.example.com',
  
  // Генерировать обработчики ошибок
  generateErrorHandlers: true,
  
  // Генерировать TypeScript типы
  generateTypes: true,
  
  // Транслитерация русских названий
  transliterateRussian: true,
});
```

## 📁 Структура сгенерированных файлов

После генерации вы получите следующую структуру:

```
generated/
├── index.ts              # Главный файл экспорта
├── http-client.ts        # Настроенный HTTP клиент
├── base.types.ts         # Базовые DTO, используемые в нескольких модулях
├── pet.api.ts            # API методы для тега "pet"
├── store.api.ts          # API методы для тега "store"
└── user.api.ts           # API методы для тега "user"
```

### Пример сгенерированного файла (pet.api.ts)

```typescript
import { httpClient } from './http-client';
import { Category, Tag } from './base.types';

/**
 * Типы для модуля: pet
 */

export interface Pet {
  id?: number;
  category?: Category;
  name: string;
  photoUrls: string[];
  tags?: Tag[];
  status?: 'available' | 'pending' | 'sold';
}

export interface ApiResponse {
  code?: number;
  type?: string;
  message?: string;
}

/**
 * API методы для: pet
 */

/**
 * Add a new pet to the store
 */
export async function addPet(body: Pet): Promise<void> {
  const url = `/pet`;
  const response = await httpClient.request({
    method: 'POST',
    url,
    data: body,
  });
  return response.data;
}

/**
 * Find pet by ID
 * Returns a single pet
 */
export async function getPetById(petId: number): Promise<Pet> {
  const url = `/pet/${petId}`;
  const response = await httpClient.request({
    method: 'GET',
    url,
  });
  return response.data;
}
```

## 🎯 Использование в автотестах Playwright

```typescript
import { test, expect } from '@playwright/test';
import { addPet, getPetById, Pet } from './api/generated';

test('API Test: Create and Get Pet', async () => {
  // Создаем питомца
  const newPet: Pet = {
    name: 'Doggie',
    photoUrls: ['https://example.com/photo.jpg'],
    status: 'available',
  };
  
  await addPet(newPet);
  
  // Получаем питомца
  const pet = await getPetById(123);
  
  // Проверяем данные
  expect(pet.name).toBe('Doggie');
  expect(pet.status).toBe('available');
});

test('API Test: Type checking', async () => {
  // TypeScript проверит типы на этапе компиляции
  const pet = await getPetById(123);
  
  // Автокомплит работает благодаря типизации
  console.log(pet.name); // ✓
  console.log(pet.unknownField); // ✗ Ошибка компиляции
});
```

## 🔧 Продвинутое использование

### Использование в тесте с fixture

```typescript
import { test as base } from '@playwright/test';
import * as PetAPI from './api/generated/pet.api';
import * as UserAPI from './api/generated/user.api';

type Fixtures = {
  petApi: typeof PetAPI;
  userApi: typeof UserAPI;
};

const test = base.extend<Fixtures>({
  petApi: async ({}, use) => {
    await use(PetAPI);
  },
  userApi: async ({}, use) => {
    await use(UserAPI);
  },
});

test('Test with API fixtures', async ({ petApi, userApi }) => {
  const pet = await petApi.getPetById(1);
  const user = await userApi.getUserByName('john');
  
  expect(pet.name).toBeTruthy();
  expect(user.username).toBe('john');
});
```

### Настройка HTTP клиента

```typescript
import { httpClient } from './api/generated/http-client';

// Добавляем токен авторизации
httpClient.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.API_TOKEN}`;
  return config;
});

// Логирование запросов
httpClient.interceptors.request.use((config) => {
  console.log(`→ ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Обработка ошибок
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);
```

## 🌍 Транслитерация

Генератор автоматически транслитерирует русские названия тегов:

| Оригинал | Имя файла |
|----------|-----------|
| Пользователи | `polzovateli.api.ts` |
| Заказы | `zakazy.api.ts` |
| Товары и услуги | `tovary-i-uslugi.api.ts` |

## 📊 Работа с DTO

### Базовые типы (base.types.ts)

Типы, используемые в нескольких тегах, автоматически выносятся в `base.types.ts`:

```typescript
// base.types.ts
export interface Category {
  id?: number;
  name?: string;
}

export interface Tag {
  id?: number;
  name?: string;
}
```

### Специфичные типы

Типы, используемые только в одном теге, остаются в файле этого тега:

```typescript
// pet.api.ts
export interface PetImage {
  url: string;
  description?: string;
}
```

### Сравнение DTO в тестах

```typescript
import { Pet } from './api/generated';

test('DTO validation', async () => {
  const pet = await getPetById(1);
  
  // TypeScript проверит соответствие типов
  const expectedStructure: Pet = {
    id: 1,
    name: 'Doggie',
    photoUrls: [],
  };
  
  // Проверяем актуальность полей
  expect(Object.keys(pet).sort()).toEqual(
    Object.keys(expectedStructure).sort()
  );
});
```

## 🔄 Обновление API

Когда API обновляется, просто перезапустите генерацию:

```typescript
// В вашем тесте или setup файле
import { generateApi } from 'openapi-typescript-generator';

// Генерируем перед запуском тестов
await generateApi({
  specUrl: process.env.API_SPEC_URL || 'https://api.example.com/openapi.json',
  outputDir: './src/api/generated',
});
```

Или создайте npm скрипт:

```json
{
  "scripts": {
    "generate-api": "node scripts/generate-api.js",
    "pretest": "npm run generate-api"
  }
}
```

## 🐛 Отладка

Генератор выводит подробную информацию в консоль:

```
🚀 Начинаю генерацию API клиента...
✓ OpenAPI спецификация загружена
📋 Версия спецификации: 2.0
✓ Спецификация распарсена
✓ Код сгенерирован
  → index.ts
  → http-client.ts
  → base.types.ts
  → pet.api.ts
  → store.api.ts
  → user.api.ts
✓ Файлы сохранены

✨ Генерация завершена! Создано файлов: 6
📁 Путь: ./generated/petstore
```

## 📝 Примеры

### Пример 1: Swagger Petstore

```typescript
await generateApi({
  specUrl: 'https://petstore.swagger.io/v2/swagger.json',
  outputDir: './generated/petstore',
  httpClient: 'axios',
});
```

### Пример 2: Локальный файл

```typescript
await generateApi({
  specUrl: './specs/my-api.json',
  outputDir: './src/api',
});
```

### Пример 3: OpenAPI 3.1 с кастомным baseUrl

```typescript
await generateApi({
  specUrl: 'https://api.example.com/v3/openapi.json',
  outputDir: './src/api/generated',
  baseUrl: process.env.API_BASE_URL,
  httpClient: 'axios',
});
```

## 🤝 Сравнение с swagger-typescript-api

| Функция | swagger-typescript-api | Этот генератор |
|---------|------------------------|----------------|
| OpenAPI 2.0 | ✅ | ✅ |
| OpenAPI 3.0 | ✅ | ✅ |
| OpenAPI 3.1 | ✅ | ✅ |
| Модульная структура по тегам | ❌ | ✅ |
| Транслитерация русских названий | ❌ | ✅ |
| Автоматическое разделение базовых DTO | ❌ | ✅ |
| Оптимизация для Playwright | ❌ | ✅ |
| Простота использования | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## 📚 API Reference

### generateApi(config)

Основная функция для генерации API клиента.

**Параметры:**

- `config.specUrl` (string, required) - URL или путь к OpenAPI документу
- `config.outputDir` (string, required) - Путь для сохранения файлов
- `config.httpClient` (string, optional) - HTTP клиент ('axios'). Default: 'axios'
- `config.baseUrl` (string, optional) - Базовый URL для API
- `config.generateErrorHandlers` (boolean, optional) - Генерировать обработчики ошибок. Default: true
- `config.generateTypes` (boolean, optional) - Генерировать TypeScript типы. Default: true
- `config.transliterateRussian` (boolean, optional) - Транслитерация русских названий. Default: true

**Возвращает:** Promise<void>

## 🛠️ Разработка

```bash
# Установка зависимостей
npm install

# Сборка
npm run build

# Разработка с watch mode
npm run dev

# Запуск примера
npm test
```

## 📄 Лицензия

MIT

## 🙏 Благодарности

Вдохновлено проектом [swagger-typescript-api](https://github.com/acacode/swagger-typescript-api)
