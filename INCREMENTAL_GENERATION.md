# ✅ Happy Path: Инкрементальная генерация + Отслеживание в БД

## Что добавлено

### 1. Отслеживание в БД

Добавлены поля в `qa.api_requests`:

```sql
test_generated BOOLEAN DEFAULT FALSE,
test_file_path VARCHAR(1000),
generated_at TIMESTAMP WITH TIME ZONE
```

**Зачем:**
- Знаем какие данные уже преобразованы в тесты
- Знаем где лежит тест
- Не генерируем дубликаты

### 2. Инкрементальная генерация

**Было:** Перегенерация всех тестов каждый раз

**Стало:** 
- Первый запуск → создаёт файл с тестами
- Повторный запуск → дополняет файл новыми тестами
- `force` режим → перегенерирует всё

### 3. Стандартная структура

Как в позитивных/негативных тестах:

```typescript
test.describe('POST /api/v1/orders - Happy Path', () => {
  test.describe.configure({ tag: '@apiHappyPath' });
  
  const endpoint = '/api/v1/orders';
  const httpMethod = 'POST';
  const success = 201;
  
  // ============================================
  // HAPPY PATH ТЕСТЫ (Данные с фронта)
  // ============================================
  
  test(`${httpMethod} Happy Path #1...`)
  test(`${httpMethod} Happy Path #2...`)
});
```

---

## Workflow

### День 1: Первая генерация

```bash
# UI тесты собрали 10 запросов
# БД: 10 записей, test_generated = FALSE

npm run generate:happy-tests

# Результат:
# ✨ orders-post.happy-path.spec.ts (10 тестов)
# БД: 10 записей, test_generated = TRUE
```

**В файле:**

```typescript
test('POST Happy Path #1 (productId: 123)', ...)
test('POST Happy Path #2 (productId: 456)', ...)
...
test('POST Happy Path #10 (productId: 999)', ...)
```

---

### День 2: Новые данные

```bash
# UI тесты собрали ещё 5 запросов
# БД: 15 записей (10 старых + 5 новых)

npm run generate:happy-tests

# Результат:
# ✓ orders-post.happy-path.spec.ts (+5 тестов)
# БД: 15 записей, все test_generated = TRUE
```

**Файл дополнен:**

```typescript
test('POST Happy Path #1 (productId: 123)', ...)  // Старый
...
test('POST Happy Path #10 (productId: 999)', ...) // Старый
test('POST Happy Path #11 (productId: 111)', ...) // Новый!
test('POST Happy Path #12 (productId: 222)', ...) // Новый!
...
test('POST Happy Path #15 (productId: 555)', ...) // Новый!
```

---

### День 3: Нет новых данных

```bash
# UI тесты не дали новых данных
# БД: 15 записей, все test_generated = TRUE

npm run generate:happy-tests

# Результат:
# ⏭️  orders-post.happy-path.spec.ts - нет новых данных
```

Файл не изменён!

---

### Force режим

```bash
# Данные изменились, нужна перегенерация

npm run generate:happy-tests -- --force

# Результат:
# 🔄 orders-post.happy-path.spec.ts (15 тестов)
# Файл полностью перезаписан
```

---

## SQL миграция

### Для существующей таблицы:

```sql
-- Добавляем новые поля
ALTER TABLE qa.api_requests 
ADD COLUMN IF NOT EXISTS test_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS test_file_path VARCHAR(1000),
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP WITH TIME ZONE;

-- Индекс для быстрого поиска несгенерированных
CREATE INDEX IF NOT EXISTS idx_api_requests_test_generated 
ON qa.api_requests(test_generated) 
WHERE test_generated = FALSE;

-- Проверяем
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN test_generated THEN 1 ELSE 0 END) as generated,
  SUM(CASE WHEN NOT test_generated THEN 1 ELSE 0 END) as pending
FROM qa.api_requests;
```

---

## Конфигурация

### Базовая (инкрементальный режим):

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "your_database",
    "username": "postgres",
    "password": "password"
  },
  "outputDir": "./tests/api/happy-path"
}
```

### С force режимом:

```json
{
  "database": { ... },
  "outputDir": "./tests/api/happy-path",
  "force": true
}
```

### Полная:

```json
{
  "database": { ... },
  "outputDir": "./tests/api/happy-path",
  "force": false,
  "maxTestsPerEndpoint": 10,
  "onlySuccessful": true,
  "testTag": "@apiHappyPath",
  "axiosHelpersPath": "../../../helpers/axiosHelpers"
}
```

---

## Логи генерации

### Первый запуск:

```
🔍 Подключаюсь к БД и собираю данные...
ℹ️  Инкрементальный режим - только новые данные
📊 Найдено 10 уникальных запросов
📁 Сгруппировано по 2 endpoints

  ✨ orders-post.happy-path.spec.ts (5 тестов)
  ✨ cart-get.happy-path.spec.ts (5 тестов)

✨ Генерация завершена!
   Всего тестов: 10
   Новых тестов: 10
```

### Повторный запуск (с новыми данными):

```
ℹ️  Инкрементальный режим - только новые данные
📊 Найдено 3 уникальных запроса
📁 Сгруппировано по 1 endpoint

  ✓ orders-post.happy-path.spec.ts (+3 теста)

✨ Генерация завершена!
   Всего тестов: 8
   Новых тестов: 3
```

### Повторный запуск (без новых данных):

```
ℹ️  Инкрементальный режим - только новые данные
📊 Найдено 0 уникальных запросов
📁 Сгруппировано по 0 endpoints

✨ Генерация завершена!
   Всего тестов: 0
   Новых тестов: 0
```

### Force режим:

```
⚠️  FORCE режим - перегенерация всех тестов
📊 Найдено 8 уникальных запросов
📁 Сгруппировано по 1 endpoint

  🔄 orders-post.happy-path.spec.ts (8 тестов)

✨ Генерация завершена!
   Всего тестов: 8
   Новых тестов: 8
```

---

## Пример сгенерированного теста

```typescript
/**
 * Happy Path тесты для POST /api/v1/orders
 * 
 * Сгенерировано автоматически из реальных данных с фронта
 * Дата: 2024-12-22T15:30:00.000Z
 * 
 * SQL запрос для поиска данных в БД:
 * SELECT * FROM qa.api_requests 
 * WHERE endpoint = '/api/v1/orders' AND method = 'POST'
 * ORDER BY created_at DESC;
 */

import { test, expect } from '@playwright/test';
import axios from 'axios';
import { configApiHeaderAdmin } from '../../../helpers/axiosHelpers';

test.describe('POST /api/v1/orders - Happy Path', () => {
  test.describe.configure({ tag: '@apiHappyPath' });

  const endpoint = '/api/v1/orders';
  const httpMethod = 'POST';
  const success = 201;

  // ============================================
  // HAPPY PATH ТЕСТЫ (Данные с фронта)
  // ============================================

  test(`${httpMethod} Happy Path #1 (productId: 123) (${success}) @apiHappyPath`, async ({ page }, testInfo) => {
    // Данные из UI теста: проверка корзины
    // DB ID: db-id-1

    // Request Body (реальные данные с фронта):
    const requestData = {
      "productId": 123,
      "quantity": 2,
      "customerId": "user-456"
    };

    // Expected Response:
    const expectedResponse = {
      "orderId": 789,
      "status": "created",
      "totalAmount": 29.99
    };

    // Выполняем запрос
    const response = await axios.post(process.env.StandURL + endpoint, requestData, configApiHeaderAdmin);

    // Проверки
    await expect(response.status).toBe(201);
    await expect(response.data).toBeDefined();
    await expect(response.data).toMatchObject(expectedResponse);
  });

  test(`${httpMethod} Happy Path #2 (productId: 456) (${success}) @apiHappyPath`, async ({ page }, testInfo) => {
    // Данные из UI теста: быстрая покупка
    // DB ID: db-id-2

    // Request Body (реальные данные с фронта):
    const requestData = {
      "productId": 456,
      "quantity": 1,
      "customerId": "user-789",
      "expressShipping": true
    };

    // Expected Response:
    const expectedResponse = {
      "orderId": 790,
      "status": "created",
      "totalAmount": 59.99
    };

    // Выполняем запрос
    const response = await axios.post(process.env.StandURL + endpoint, requestData, configApiHeaderAdmin);

    // Проверки
    await expect(response.status).toBe(201);
    await expect(response.data).toBeDefined();
    await expect(response.data).toMatchObject(expectedResponse);
  });
});
```

---

## SQL запросы для мониторинга

### Статистика генерации:

```sql
SELECT 
  COUNT(*) as total_requests,
  SUM(CASE WHEN test_generated THEN 1 ELSE 0 END) as tests_generated,
  SUM(CASE WHEN NOT test_generated THEN 1 ELSE 0 END) as pending_tests,
  ROUND(100.0 * SUM(CASE WHEN test_generated THEN 1 ELSE 0 END) / COUNT(*), 2) as coverage_percent
FROM qa.api_requests;
```

### По endpoints:

```sql
SELECT 
  endpoint,
  method,
  COUNT(*) as total,
  SUM(CASE WHEN test_generated THEN 1 ELSE 0 END) as generated,
  MAX(generated_at) as last_generation
FROM qa.api_requests
GROUP BY endpoint, method
ORDER BY total DESC;
```

### Несгенерированные данные:

```sql
SELECT 
  endpoint,
  method,
  COUNT(*) as pending_tests
FROM qa.api_requests
WHERE test_generated = FALSE
GROUP BY endpoint, method
ORDER BY pending_tests DESC;
```

### По файлам тестов:

```sql
SELECT 
  test_file_path,
  COUNT(*) as test_count,
  MIN(generated_at) as first_test,
  MAX(generated_at) as last_test
FROM qa.api_requests
WHERE test_generated = TRUE
GROUP BY test_file_path
ORDER BY test_count DESC;
```

---

## Jenkins Pipeline

```groovy
stage('Генерация Happy Path тестов') {
    steps {
        script {
            // Первый раз или инкрементально
            sh 'npm run generate:happy-tests'
            
            // Если нужна перегенерация
            if (params.FORCE_REGENERATE) {
                sh 'npm run generate:happy-tests -- --force'
            }
        }
    }
}
```

---

## NPM скрипты

```json
{
  "scripts": {
    "generate:happy-tests": "ts-node scripts/generate-happy-tests.ts",
    "generate:happy-tests:force": "ts-node scripts/generate-happy-tests.ts --force",
    "test:happy-path": "playwright test --grep @apiHappyPath"
  }
}
```

**scripts/generate-happy-tests.ts:**

```typescript
import { generateHappyPathTests } from '@your-company/api-codegen';

const config = require('../happy-path-config.json');

// Проверяем --force флаг
const isForce = process.argv.includes('--force');

generateHappyPathTests({
  ...config,
  force: isForce
})
  .then(() => console.log('✅ Готово!'))
  .catch(err => {
    console.error('❌ Ошибка:', err);
    process.exit(1);
  });
```

---

## ✅ Итого

- ✅ **Отслеживание в БД** - знаем что сгенерировано
- ✅ **Инкрементальная генерация** - только новые тесты
- ✅ **Force режим** - для перегенерации
- ✅ **Стандартная структура** - как позитивные/негативные
- ✅ **SQL в комментариях** - для поиска в БД
- ✅ **DB ID в тестах** - для отслеживания

**Production ready!** 🎉✨
