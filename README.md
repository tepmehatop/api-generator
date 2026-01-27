# API Generator - Генератор API клиентов и тестов

Комплексное решение для генерации TypeScript API клиентов из OpenAPI спецификаций + автоматическая генерация тестов Playwright + Happy Path тесты на основе реальных данных.

## 🎉 Что нового в v13.0

- **🎯 Happy Path интеграция в generateApiTests**: Использование реальных данных из UI тестов (`qa.api_requests`)
- **🔄 Интеллектуальная стратегия повторов**: 10-15 попыток получить успешный ответ с умным fallback
- **📊 Валидация данных**: Проверка актуальности данных перед генерацией (v12.0+)
- **🎲 Дедупликация тестов**: Группировка по signature для избежания дублирования (v12.0+)
- **📁 Отдельные файлы данных**: Организованные `testData/*.data.ts` файлы для каждого endpoint
- **❌ Убран Content-Type тест**: Удален unsupportedMediaType (415) тест из негативных сценариев

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

### 2. Генерация тестов (позитивные/негативные/pairwise) - v13.0

```typescript
import { generateApiTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

await generateApiTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders',

  // v13.0: Happy Path интеграция
  useHappyPathData: true,
  dbConnection: sql,
  dbSchema: 'qa',
  happyPathSamplesCount: 15,
  maxDataGenerationAttempts: 10
});
```

**Что генерируется:**
- ✅ Позитивные тесты (с обязательными полями, со всеми полями)
- ✅ Негативные тесты (400, 401, 403, 404, 405)
- ✅ Pairwise тесты (комбинаторное покрытие)
- ✅ Использует реальные данные из `qa.api_requests` таблицы

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
| `generateApiTests()` | Генерация позитивных/негативных/pairwise тестов | v13.0 |
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

### v13.0 (Текущая)
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
