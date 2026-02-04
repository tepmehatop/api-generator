# API Generator - Генератор API клиентов и тестов

Комплексное решение для генерации TypeScript API клиентов из OpenAPI спецификаций + автоматическая генерация тестов Playwright + Happy Path тесты на основе реальных данных.

## 🎉 Что нового в v14.0

- **🎯 Раздельные методы генерации**: `generateNegativeTests()`, `generatePositiveTests()`, `generatePairwiseTests()`
- **📁 Поддержка папок**: Теперь можно указывать папку с файлами, а не только один файл
- **🗂️ Автогруппировка**: Тесты автоматически группируются по категориям (orders/, users/ и т.д.)
- **🔧 Правильная интеграция apiTestHelper**: Хелпер теперь используется в негативных тестах при падении
- **📊 Детальный отчет**: "Не удалось сгенерировать" с причинами (no_dto, no_endpoint и т.д.)
- **🔒 Защита тестов**: Возможность помечать тесты как `@protected` для защиты от обновления

## 📦 Что внутри

1. **API Generator** - Генерация TypeScript API клиентов из OpenAPI спецификаций
2. **Test Generator** - Автоматическая генерация Playwright тестов с Happy Path данными (v13.0)
3. **Happy Path Generator** - Генерация Happy Path тестов из реальных данных UI тестов (v12.0)
4. **Database Analyzer** - Извлечение реальных данных из БД с интеллектуальными повторами (v13.0)
5. **API Collector** - Сбор данных из UI тестов для Happy Path

## 🚀 Быстрый старт

### Установка

```bash
npm install @your-company/api-codegen
```

### 1. Генерация API клиента из OpenAPI

```typescript
import { generateApi } from '@your-company/api-codegen';

await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './api',
  httpClient: 'axios',
  baseUrl: 'process.env.API_BASE_URL'
});
```

**Результат:**
```
api/
├── orders.api.ts      # API методы
├── orders.types.ts    # TypeScript типы
├── products.api.ts
└── products.types.ts
```

### 2. Генерация негативных тестов - v14.0 ⭐ NEW

```typescript
import { generateNegativeTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

// Вариант 1: Один файл
await generateNegativeTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/negative',
  dbConnection: sql
});

// Вариант 2: Вся папка с автогруппировкой
await generateNegativeTests({
  apiFilePath: './api/',  // ← Вся папка!
  outputDir: './tests/api/negative',
  groupByCategory: true,  // ← Создаст подпапки orders/, users/
  generate401Tests: true,
  generate403Tests: true,
  generate400Tests: true,
  generate404Tests: true,
  generate405Tests: true,
  dbConnection: sql
});
```

**Что генерируется:**
- ✅ Негативные тесты (401, 403, 400, 404, 405)
- ✅ Автоматическая группировка по категориям
- ✅ Правильное использование `apiTestHelper` при падении
- ✅ Детальный отчет с причинами неудач

### 2.1 Генерация позитивных тестов - v14.0 ⭐ NEW

```typescript
import { generatePositiveTests } from '@your-company/api-codegen';

await generatePositiveTests({
  apiFilePath: './api/',
  outputDir: './tests/api/positive',
  generateRequiredFieldsTest: true,
  generateAllFieldsTest: true,
  groupByCategory: true,
  dbConnection: sql
});
```

**Что генерируется:**
- ✅ Позитивные тесты (с обязательными полями, со всеми полями)
- ✅ Использует реальные данные из `qa.api_requests` таблицы

### 2.2 Генерация pairwise тестов - v14.0 ⭐ NEW

```typescript
import { generatePairwiseTests } from '@your-company/api-codegen';

await generatePairwiseTests({
  apiFilePath: './api/',
  outputDir: './tests/api/pairwise',
  generateOptionalCombinations: true,
  generateEnumTests: true,
  maxPairwiseCombinations: 10,
  groupByCategory: true,
  dbConnection: sql
});
```

**Что генерируется:**
- ✅ Pairwise тесты (комбинаторное покрытие)
- ✅ Комбинации необязательных полей
- ✅ Тесты для enum значений

### 3. Генерация Happy Path тестов - v12.0

```typescript
import { generateHappyPathTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

await generateHappyPathTests({
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'qa',
  maxTestsPerEndpoint: 10
}, sql);
```

**Особенности:**
- ✅ Тесты на основе реальных данных из UI тестов
- ✅ Глубокое сравнение ответов с БД
- ✅ Валидация типов из DTO
- ✅ Дедупликация похожих тестов (v12.0)
- ✅ Проверка актуальности данных (v12.0)

### 4. Анализ БД и генерация данных - v13.0

```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({ /* ... */ });

await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',

  // v13.0: Happy Path интеграция
  useHappyPathData: true,
  happyPathSchema: 'qa',
  maxAttempts: 10
}, sql);
```

**Что делает:**
1. Анализирует схему БД
2. Получает Happy Path данные из `qa.api_requests`
3. Генерирует fallback данные
4. Делает 10-15 попыток получить 200 ответ
5. Обновляет тест файл рабочими данными

### 5. Сбор данных из UI тестов

```typescript
import { collectApiData } from '@your-company/api-codegen';

test.beforeEach(async ({ page }, testInfo) => {
  await collectApiData(page, testInfo, {
    serviceUrl: 'http://vm-host:3000',
    endpoint: '/api/collect-data',
    urlFilters: ['/api/']
  });
});
```

## 🔒 Защита тестов от обновления (v14.0) ⭐ NEW

Иногда требуется защитить отдельные тесты от перезаписи при повторной генерации.

### Способ 1: Защита всего файла

```typescript
// @readonly

import test, { expect } from '../../../fixtures/baseTest';
// ... остальной код
```

### Способ 2: Защита конкретного теста

```typescript
/* @protected:start:custom400Test */
test(`POST с некорректными данными (400) @api @negative`, async ({ page }, testInfo) => {
  try {
    await axios.post(process.env.StandURL + endpoint, { invalid: 'data' }, configApiHeaderAdmin);
    throw new Error('Ожидалась ошибка 400');
  } catch (error: any) {
    // Это ожидаемая 400 ошибка от разработчиков - НЕ ИСПРАВЛЯТЬ
    await expect(error.response.status).toBe(400);
    await expect(error.response.data.message).toBe('Expected validation error');
  }
});
/* @protected:end:custom400Test */
```

**Важно:** При повторной генерации защищенные блоки полностью сохраняются!

---

## 🗄️ Настройка БД (v13.0)

### Таблица для Happy Path данных

```sql
CREATE TABLE qa.api_requests (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_body JSONB,
  response_body JSONB,
  response_status INTEGER NOT NULL,
  test_name VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_requests_endpoint_method
  ON qa.api_requests(endpoint, method, response_status);
```

### Переменные окружения

```bash
# Для Happy Path интеграции
StandURL=https://api.example.com
AUTH_TOKEN=your_auth_token

# Подключение к БД
DB_HOST=localhost
DB_NAME=test_database
DB_USER=postgres
DB_PASSWORD=password
```

## 📊 Основные методы

| Метод | Описание | Версия |
|-------|----------|--------|
| `generateApi()` | Генерация API клиента из OpenAPI | - |
| ⭐ `generateNegativeTests()` | Генерация ТОЛЬКО негативных тестов (401, 403, 400, 404, 405) | v14.0 |
| ⭐ `generatePositiveTests()` | Генерация ТОЛЬКО позитивных тестов (200, 201) | v14.0 |
| ⭐ `generatePairwiseTests()` | Генерация ТОЛЬКО pairwise комбинаций | v14.0 |
| 🚫 `generateApiTests()` | Генерация всех тестов (**DEPRECATED** - используйте раздельные методы) | v13.0 |
| `generateHappyPathTests()` | Генерация Happy Path тестов из БД | v12.0 |
| `analyzeAndGenerateTestData()` | Анализ БД и генерация данных | v13.0 |
| `collectApiData()` | Сбор данных из UI тестов | - |

## 📚 Документация

- **[README_FULL.md](./README_FULL.md)** - Полная документация со всеми конфигурациями и примерами
- **[CHAT_CONTEXT_EXPORT.md](./CHAT_CONTEXT_EXPORT.md)** - История разработки и контекст проекта

## 🔧 Минимальная конфигурация

### generateApiTests (v13.0)

```typescript
await generateApiTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders'
});
```

### generateHappyPathTests (v12.0)

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect'
}, sql);
```

### analyzeAndGenerateTestData (v13.0)

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema'
}, sql);
```

## 🎯 Workflow

```
┌─────────────────────────────────────────┐
│ 1. UI Тесты                             │
│    └─> Собирают API запросы/ответы      │
│         └─> Сохраняют в qa.api_requests │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 2. Генерация тестов (v13.0)            │
│    ├─> generateApiTests()               │
│    │   └─> Использует Happy Path данные │
│    └─> generateHappyPathTests()         │
│        └─> Создает тесты из БД          │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 3. Запуск тестов                        │
│    └─> Тесты используют реальные данные │
│        └─> Меньше flaky тестов          │
└─────────────────────────────────────────┘
```

## 📝 История версий

### v14.0 (Текущая) ⭐
- ✅ **Раздельные методы генерации**: `generateNegativeTests()`, `generatePositiveTests()`, `generatePairwiseTests()`
- ✅ **Поддержка папок**: Можно указать папку с файлами вместо одного файла
- ✅ **Автогруппировка**: Тесты группируются по категориям (orders/, users/)
- ✅ **Правильная интеграция apiTestHelper**: Используется в негативных тестах при падении
- ✅ **Детальный отчет**: "Не удалось сгенерировать" с причинами
- ✅ **Защита тестов**: Теги `@protected` для защиты от обновления
- 🚫 `generateApiTests()` помечен как **DEPRECATED**

### v13.0
- ✅ Happy Path интеграция в `generateApiTests()`
- ✅ Интеллектуальная стратегия повторов (10-15 попыток)
- ✅ Отдельные `testData/*.data.ts` файлы
- ✅ Убран Content-Type (415) тест
- ✅ Умная генерация данных с остановкой на 401/403

### v12.0
- ✅ Валидация данных с обнаружением stale data
- ✅ Дедупликация тестов (signature-based)
- ✅ Обнаружение edge cases (null, пустые массивы)
- ✅ Конфигурируемые правила валидации и дедупликации

### v11.1
- ✅ Динамический импорт utils из NPM пакета
- ✅ Автоматическое определение имени пакета

### v11.0
- API клиент из OpenAPI
- Базовая генерация тестов
- Анализ БД для данных
- Happy Path тесты

## 🆘 Поддержка

**Полная документация:** [README_FULL.md](./README_FULL.md)

**GitHub:** https://github.com/tepmehatop/api-generator

**NPM:** `@your-company/api-codegen`

## 📄 Лицензия

MIT
