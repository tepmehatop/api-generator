### ✅ Happy Path Тесты - Полное руководство

## Что это?

Happy Path тесты - это автотесты основанные на **реальных данных** с фронта. Собираем request/response во время UI тестов и генерируем API тесты.

## Архитектура

```
┌─────────────┐        ┌───────────────┐        ┌──────────────┐        ┌──────────────┐
│  UI Тесты   │──────▶│  Коллектор    │──────▶│   Express    │──────▶│  PostgreSQL  │
│ (Playwright)│ page.on│  (beforeEach) │  POST │   Service    │  SQL  │   (qa схема) │
└─────────────┘        └───────────────┘        └──────────────┘        └──────────────┘
                                                                                 │
                                                                                 │ SELECT
                                                                                 ▼
                                                                         ┌──────────────┐
                                                                         │   Генератор  │
                                                                         │ Happy Path   │
                                                                         │    Тестов    │
                                                                         └──────────────┘
```

---

## Шаг 1: Настройка БД

### 1.1 Создайте таблицы

```bash
# Подключитесь к PostgreSQL
psql -U postgres -d your_database

# Выполните SQL скрипт
\i create-qa-schema.sql
```

**Или:**

```bash
psql -U postgres -d your_database -f create-qa-schema.sql
```

### Что создаётся:

- ✅ Схема `qa`
- ✅ Таблица `qa.api_requests` - хранилище данных
- ✅ 7 индексов для быстрого поиска
- ✅ 2 представления для статистики
- ✅ 2 функции-хелперы

---

## Шаг 2: Запуск Express сервиса

### 2.1 Установите зависимости

```bash
npm install express postgres cors body-parser
```

### 2.2 Настройте переменные окружения

Создайте `.env`:

```ini
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=postgres
DB_PASSWORD=your_password
```

### 2.3 Запустите сервис

```bash
node api-collector-service.js
```

**Логи:**

```
🚀 API Collector Service запущен

📡 Порт: 3000
🗄️  База: your_database
📊 Схема: qa

Endpoints:
  POST /api/collect-data        - Сбор данных из тестов
  GET  /api/endpoints            - Список endpoints
  GET  /api/endpoint-data/:path  - Данные для endpoint
  GET  /api/unique-requests      - Уникальные запросы
  GET  /health                   - Health check
```

### 2.4 Проверьте работу

```bash
curl http://localhost:3000/health
```

Должно вернуть:

```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-12-22T..."
}
```

---

## Шаг 3: Интеграция в UI тесты

### 3.1 Обновите beforeEach

```typescript
import { test } from '@playwright/test';
import { collectApiData } from '@your-company/api-codegen/test-helpers';

test.beforeEach(async ({ page }, testInfo) => {
  // Ваш существующий метод
  await getReportData(page, testInfo);
  
  // Добавляем сбор API данных
  await collectApiData(page, testInfo, {
    serviceUrl: 'http://192.168.1.100:3000',  // URL вашего сервиса
    urlFilters: ['/api/v1/'],                 // Собираем только API запросы
    excludeUrls: ['/health', '/metrics'],    // Исключаем служебные
    verbose: true                             // Детальные логи
  });
});

test('проверка корзины', async ({ page }) => {
  // Ваш тест
  await page.goto('/cart');
  await page.click('button#add-to-cart');
  
  // Во время выполнения автоматически собираются:
  // - POST /api/v1/cart/add
  // - GET /api/v1/cart
  // - PUT /api/v1/cart/update
  // И отправляются в БД!
});
```

### 3.2 Или создайте предустановленный коллектор

```typescript
// test-helpers/api-collector.ts
import { createCollector } from '@your-company/api-codegen/test-helpers';

export const apiCollector = createCollector({
  serviceUrl: process.env.API_COLLECTOR_URL || 'http://192.168.1.100:3000',
  urlFilters: ['/api/v1/', '/api/v2/'],
  excludeUrls: ['/health', '/metrics', '/ping'],
  verbose: process.env.VERBOSE_LOGS === 'true'
});

// Использование:
test.beforeEach(async ({ page }, testInfo) => {
  await getReportData(page, testInfo);
  await apiCollector(page, testInfo);
});
```

### Что собирается?

Для каждого API запроса:
- ✅ Endpoint (`/api/v1/orders`)
- ✅ HTTP метод (`POST`, `GET`, etc.)
- ✅ Request body (JSON)
- ✅ Response body (JSON)
- ✅ Response status (200, 201, etc.)
- ✅ Timestamp
- ✅ Название теста
- ✅ Файл теста

---

## Шаг 4: Запуск UI тестов

```bash
# Обычный запуск
npm test

# Или с verbose логами
VERBOSE_LOGS=true npm test
```

### Логи при сборе данных:

```
[API Collector] Начинаю сбор данных для теста: проверка корзины
[API Collector] Собрано: POST /api/v1/cart/add -> 201
[API Collector] Собрано: GET /api/v1/cart -> 200
[API Collector] Собрано: PUT /api/v1/cart/update -> 200
[API Collector] Отправляю 3 записей на http://192.168.1.100:3000/api/collect-data
[API Collector] ✓ Данные успешно отправлены
```

---

## Шаг 5: Проверка данных в БД

```sql
-- Сколько данных собрано?
SELECT COUNT(*) FROM qa.api_requests;

-- Какие endpoints собраны?
SELECT endpoint, method, COUNT(*) 
FROM qa.api_requests 
GROUP BY endpoint, method 
ORDER BY COUNT(*) DESC;

-- Уникальные комбинации для endpoint
SELECT * FROM qa.get_unique_requests_for_endpoint('/api/v1/orders', 'POST');

-- Статистика по всем endpoints
SELECT * FROM qa.api_endpoints_stats LIMIT 10;
```

---

## Шаг 6: Генерация Happy Path тестов

### 6.1 Создайте конфиг

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "your_database",
    "username": "postgres",
    "password": "your_password"
  },
  "outputDir": "./tests/api/happy-path",
  "maxTestsPerEndpoint": 5,
  "testTag": "@apiHappyPath"
}
```

### 6.2 Запустите генерацию

```typescript
// generate-happy-tests.ts
import { generateHappyPathTests } from '@your-company/api-codegen';

const config = require('./happy-path-config.json');

generateHappyPathTests(config)
  .then(() => console.log('✅ Тесты сгенерированы!'))
  .catch(err => console.error('❌ Ошибка:', err));
```

```bash
npx ts-node generate-happy-tests.ts
```

### Или через NPM скрипт:

```json
{
  "scripts": {
    "generate:happy-tests": "ts-node scripts/generate-happy-tests.ts"
  }
}
```

```bash
npm run generate:happy-tests
```

---

## Шаг 7: Запуск Happy Path тестов

```bash
# Запустить только Happy Path тесты
npx playwright test --grep @apiHappyPath

# Или через NPM скрипт
npm run test:happy-path
```

**package.json:**

```json
{
  "scripts": {
    "test:happy-path": "playwright test --grep @apiHappyPath"
  }
}
```

---

## Пример сгенерированного теста

### Входные данные в БД:

```sql
SELECT * FROM qa.api_requests 
WHERE endpoint = '/api/v1/orders' AND method = 'POST'
LIMIT 1;
```

| id | endpoint | method | request_body | response_body | response_status |
|----|----------|--------|--------------|---------------|-----------------|
| 1 | /api/v1/orders | POST | {"productId": 123, "quantity": 2} | {"orderId": 456, "status": "created"} | 201 |

### Сгенерированный тест:

```typescript
/**
 * Happy Path тесты для POST /api/v1/orders
 * 
 * Сгенерировано автоматически из реальных данных с фронта
 * Дата: 2024-12-22T10:30:00.000Z
 * 
 * SQL запрос для поиска данных в БД:
 * SELECT * FROM qa.api_requests 
 * WHERE endpoint = '/api/v1/orders' AND method = 'POST'
 * ORDER BY created_at DESC;
 */

import { test, expect } from '@playwright/test';
import { createOrder } from '@your-company/api-codegen';

test.describe('POST /api/v1/orders - Happy Path', () => {
  test.describe.configure({ tag: '@apiHappyPath' });

  test('должен успешно обработать запрос #1 (productId: 123)', async () => {
    // Данные из теста: проверка корзины
    // ID записи в БД: 1

    // Request Body:
    const requestData = {
      "productId": 123,
      "quantity": 2
    };

    // Expected Response:
    const expectedResponse = {
      "orderId": 456,
      "status": "created"
    };

    // Выполняем запрос
    const response = await createOrder(requestData);

    // Проверки
    expect(response.status).toBe(201);
    expect(response.data).toMatchObject(expectedResponse);
  });
});
```

---

## Настройки генератора

### Полная конфигурация:

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "your_database",
    "username": "postgres",
    "password": "your_password"
  },
  "outputDir": "./tests/api/happy-path",
  
  "endpointFilter": [
    "/api/v1/orders",
    "/api/v1/cart"
  ],
  
  "methodFilter": [
    "POST",
    "PUT"
  ],
  
  "maxTestsPerEndpoint": 5,
  "onlySuccessful": true,
  "testTag": "@apiHappyPath"
}
```

### Параметры:

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `database` | Подключение к БД | обязательно |
| `outputDir` | Папка для тестов | обязательно |
| `endpointFilter` | Фильтр по endpoint | все |
| `methodFilter` | Фильтр по HTTP методу | все |
| `maxTestsPerEndpoint` | Макс. тестов на endpoint | 5 |
| `onlySuccessful` | Только 2xx ответы | true |
| `testTag` | Тег для тестов | @apiHappyPath |

---

## Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('UI Тесты + Сбор данных') {
            steps {
                sh '''
                    # Запускаем UI тесты с collector'ом
                    export API_COLLECTOR_URL=http://192.168.1.100:3000
                    npm test
                '''
            }
        }
        
        stage('Генерация Happy Path тестов') {
            steps {
                sh '''
                    # Генерируем тесты из собранных данных
                    npm run generate:happy-tests
                '''
            }
        }
        
        stage('Запуск Happy Path тестов') {
            steps {
                sh '''
                    # Запускаем сгенерированные тесты
                    npm run test:happy-path
                '''
            }
        }
    }
}
```

---

## Troubleshooting

### Данные не отправляются

**Проверка 1:** Сервис запущен?

```bash
curl http://192.168.1.100:3000/health
```

**Проверка 2:** Правильный URL?

```typescript
collectApiData(page, testInfo, {
  serviceUrl: 'http://192.168.1.100:3000',  // Проверьте IP и порт
  verbose: true
});
```

### Данные не сохраняются в БД

**Проверка 1:** Подключение к БД работает?

```bash
psql -U postgres -h localhost -d your_database -c "SELECT COUNT(*) FROM qa.api_requests;"
```

**Проверка 2:** Таблица создана?

```sql
\dt qa.*
```

### Тесты не генерируются

**Проверка 1:** Есть данные в БД?

```sql
SELECT COUNT(*) FROM qa.api_requests WHERE response_status >= 200 AND response_status < 300;
```

**Проверка 2:** Правильный конфиг?

```typescript
console.log(JSON.stringify(config, null, 2));
```

---

## Полезные SQL запросы

```sql
-- Top 10 endpoints
SELECT endpoint, method, COUNT(*) as count
FROM qa.api_requests
GROUP BY endpoint, method
ORDER BY count DESC
LIMIT 10;

-- Данные за последний час
SELECT * FROM qa.api_requests
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Уникальные request для endpoint
SELECT DISTINCT request_body::text
FROM qa.api_requests
WHERE endpoint = '/api/v1/orders' AND method = 'POST';

-- Очистка старых данных (старше 30 дней)
SELECT qa.cleanup_old_api_requests(30);
```

---

## ✅ Итого

- ✅ **Сбор данных** из UI тестов автоматически
- ✅ **Хранение в БД** через Express сервис
- ✅ **Генерация тестов** из реальных данных
- ✅ **Тег @apiHappyPath** для изоляции
- ✅ **Dedupликация** - нет повторяющихся тестов

**Готово к production!** 🎉✨
