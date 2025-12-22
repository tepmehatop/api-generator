# ✅ Исправлено: Сбор данных с фронта через page.on()

## Проблема

В методе `collectApiData` не было реализовано `page.on('response')` для трейсинга Network запросов.

## Решение

Создан полноценный коллектор с:
- ✅ `page.on('response')` - трейсинг всех запросов
- ✅ Фильтрация по URL
- ✅ Парсинг request/response body
- ✅ Отправка на сервер
- ✅ Правильные хуки (beforeEach/afterEach)

---

## Как использовать

### Вариант 1: Раздельные хуки (рекомендуется)

```typescript
import { test } from '@playwright/test';
import { setupApiCollector, sendCollectedData } from '@your-company/api-codegen';

test.beforeEach(async ({ page }, testInfo) => {
  // Ваш существующий метод
  await getReportData(page, testInfo);
  
  // Настраиваем коллектор
  setupApiCollector(page, testInfo, {
    serviceUrl: 'http://192.168.1.100:3000',
    urlFilters: ['/api/v1/', '/api/v2/'],
    excludeUrls: ['/health', '/metrics'],
    verbose: true
  });
});

test.afterEach(async ({ page }, testInfo) => {
  // Отправляем собранные данные
  await sendCollectedData(page, testInfo);
});

test('проверка корзины', async ({ page }) => {
  await page.goto('/cart');
  await page.click('#add-to-cart');
  
  // Автоматически соберёт:
  // POST /api/v1/cart/add
  // GET /api/v1/cart
  // И отправит в БД!
});
```

### Вариант 2: С предустановленной конфигурацией

```typescript
// test-helpers/api-collector.ts
import { createCollector } from '@your-company/api-codegen';

export const apiCollector = createCollector({
  serviceUrl: process.env.API_COLLECTOR_URL || 'http://192.168.1.100:3000',
  urlFilters: ['/api/'],
  excludeUrls: ['/health', '/metrics', '/ping'],
  verbose: process.env.VERBOSE_LOGS === 'true'
});

// tests/cart.spec.ts
import { apiCollector } from '../test-helpers/api-collector';

test.beforeEach(async ({ page }, testInfo) => {
  await getReportData(page, testInfo);
  apiCollector.setup(page, testInfo);
});

test.afterEach(async ({ page }, testInfo) => {
  await apiCollector.send(page, testInfo);
});
```

---

## Как это работает

### 1. beforeEach - Настройка

```typescript
setupApiCollector(page, testInfo, config);
```

**Что происходит:**
1. Создаётся обработчик `page.on('response')`
2. Обработчик слушает все HTTP запросы
3. Фильтрует по `urlFilters` и `excludeUrls`
4. Парсит request body и response body
5. Сохраняет в памяти

### 2. Во время теста - Сбор

```typescript
test('пример', async ({ page }) => {
  await page.goto('/cart');           // → GET /api/v1/cart
  await page.click('#add-to-cart');   // → POST /api/v1/cart/add
  await page.click('#checkout');      // → POST /api/v1/orders
});
```

**Автоматически собирается:**
- Endpoint: `/api/v1/cart`
- Method: `GET`
- Request body: `null`
- Response body: `{ "items": [...] }`
- Status: `200`

### 3. afterEach - Отправка

```typescript
await sendCollectedData(page, testInfo);
```

**Что происходит:**
1. Отписывается от `page.on('response')`
2. Сохраняет данные как Playwright артефакт
3. Отправляет POST на `http://192.168.1.100:3000/api/collect-data`
4. Очищает память

---

## Логи при работе

### С verbose: true

```
[API Collector] 🔍 Начинаю сбор для: проверка корзины
[API Collector] ✓ GET /api/v1/cart -> 200
[API Collector] ✓ POST /api/v1/cart/add -> 201
[API Collector] ✓ GET /api/v1/cart -> 200
[API Collector] ✓ POST /api/v1/orders -> 201
[API Collector] 📤 Отправляю 4 записей...
[API Collector] ✅ Отправлено: 4 записей
```

### С verbose: false

```
(тихо работает в фоне)
```

---

## Конфигурация

### Полная:

```typescript
setupApiCollector(page, testInfo, {
  // URL сервиса для отправки
  serviceUrl: 'http://192.168.1.100:3000',
  
  // Эндпоинт для отправки
  endpoint: '/api/collect-data',
  
  // Собирать только URL содержащие эти строки
  urlFilters: ['/api/v1/', '/api/v2/'],
  
  // Исключить URL содержащие эти строки
  excludeUrls: ['/health', '/metrics', '/ping', '/socket.io'],
  
  // Детальные логи
  verbose: true
});
```

### Минимальная:

```typescript
setupApiCollector(page, testInfo);
// Использует defaults из переменных окружения или localhost:3000
```

### Переменные окружения:

```bash
# .env
API_COLLECTOR_URL=http://192.168.1.100:3000
```

```typescript
// Автоматически подхватится
setupApiCollector(page, testInfo);
```

---

## Что собирается

Для каждого API запроса:

```typescript
{
  endpoint: "/api/v1/cart/add",
  method: "POST",
  requestBody: {
    "productId": 123,
    "quantity": 2
  },
  responseBody: {
    "cartId": 456,
    "status": "added"
  },
  responseStatus: 201,
  timestamp: "2024-12-22T16:00:00.000Z",
  testName: "проверка корзины",
  testFile: "/tests/cart.spec.ts"
}
```

---

## Фильтрация

### Собирать только API:

```typescript
urlFilters: ['/api/']  // Только URL содержащие /api/
```

### Исключить служебные:

```typescript
excludeUrls: [
  '/health',      // Health checks
  '/metrics',     // Prometheus metrics
  '/ping',        // Ping/pong
  '/socket.io',   // WebSocket
  '.png',         // Изображения
  '.css',         // Стили
  '.js'           // Скрипты
]
```

### Пример сложной фильтрации:

```typescript
setupApiCollector(page, testInfo, {
  urlFilters: [
    '/api/v1/orders',
    '/api/v1/cart',
    '/api/v1/products'
  ],
  excludeUrls: [
    '/api/v1/orders/stats',  // Исключаем статистику
    '/api/v1/products/search' // Исключаем поиск (слишком много данных)
  ]
});
```

---

## Playwright артефакты

Данные автоматически сохраняются как артефакт:

```bash
# После запуска тестов
ls test-results/cart-spec-ts-проверка-корзины/

# Файлы:
collected-api-data.json  ← Собранные API данные
```

**Содержимое:**

```json
[
  {
    "endpoint": "/api/v1/cart/add",
    "method": "POST",
    "requestBody": { "productId": 123 },
    "responseBody": { "cartId": 456 },
    "responseStatus": 201,
    "timestamp": "2024-12-22T16:00:00.000Z",
    "testName": "проверка корзины",
    "testFile": "/tests/cart.spec.ts"
  }
]
```

---

## Troubleshooting

### Данные не собираются

**Проверка 1:** Правильные фильтры?

```typescript
setupApiCollector(page, testInfo, {
  urlFilters: ['/api/'],  // Проверьте что ваши URL содержат /api/
  verbose: true           // Включите логи
});
```

**Проверка 2:** API запросы выполняются?

```typescript
test('debug', async ({ page }) => {
  // Открываем DevTools в браузере
  await page.pause();
  
  // Смотрим Network tab
  // Проверяем что запросы действительно идут
});
```

### Данные не отправляются

**Проверка 1:** Сервис запущен?

```bash
curl http://192.168.1.100:3000/health
# Должен вернуть: {"status":"healthy"}
```

**Проверка 2:** URL правильный?

```typescript
setupApiCollector(page, testInfo, {
  serviceUrl: 'http://192.168.1.100:3000',  // Проверьте IP и порт
  verbose: true
});
```

**Проверка 3:** Вызывается afterEach?

```typescript
test.afterEach(async ({ page }, testInfo) => {
  console.log('afterEach вызван!');
  await sendCollectedData(page, testInfo);
});
```

### Response body пустой

**Причина:** Response не JSON или уже прочитан

**Проверка:**

```typescript
page.on('response', async (response) => {
  const contentType = response.headers()['content-type'];
  console.log('Content-Type:', contentType);
  // Должен быть: application/json
});
```

---

## Полный пример

```typescript
// tests/cart.spec.ts
import { test } from '@playwright/test';
import { setupApiCollector, sendCollectedData } from '@your-company/api-codegen';

test.describe('Корзина', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Ваш существующий getReportData
    await getReportData(page, testInfo);
    
    // Настраиваем коллектор
    setupApiCollector(page, testInfo, {
      serviceUrl: process.env.API_COLLECTOR_URL,
      urlFilters: ['/api/v1/'],
      excludeUrls: ['/health', '/metrics'],
      verbose: true
    });
  });
  
  test.afterEach(async ({ page }, testInfo) => {
    // Отправляем данные
    await sendCollectedData(page, testInfo);
  });
  
  test('добавление товара', async ({ page }) => {
    await page.goto('/products/123');
    await page.click('[data-testid="add-to-cart"]');
    await page.waitForURL('/cart');
    
    // Автоматически собрано:
    // GET /api/v1/products/123
    // POST /api/v1/cart/add
    // GET /api/v1/cart
  });
  
  test('оформление заказа', async ({ page }) => {
    await page.goto('/cart');
    await page.click('[data-testid="checkout"]');
    await page.fill('[name="email"]', 'test@example.com');
    await page.click('[data-testid="submit-order"]');
    
    // Автоматически собрано:
    // GET /api/v1/cart
    // POST /api/v1/orders
    // GET /api/v1/orders/456
  });
});
```

---

## ✅ Итого

- ✅ **page.on('response')** - реально трейсит Network
- ✅ **Фильтрация** - только нужные запросы
- ✅ **Парсинг** - request и response body
- ✅ **Отправка** - на сервер автоматически
- ✅ **Артефакты** - сохраняются в test-results
- ✅ **Логи** - verbose режим для отладки

**Готово к использованию!** 🎉✨
