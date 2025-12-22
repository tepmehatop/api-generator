# ✅ Решено: Batch отправка + Без afterEach

## Проблемы

1. ❌ **Entity too large** - 200-300 запросов в одном теске
2. ❌ **afterEach** - нужно добавлять в 200+ UI тестов вручную

## Решение

✅ **Автоматическая порционная отправка**
- Данные отправляются batch'ами по 20 запросов
- Отправка каждые 5 секунд (даже если batch не заполнен)
- Финальная отправка остатков после теста
- **БЕЗ afterEach!**

---

## Как использовать (ТОЛЬКО beforeEach!)

### Было (с afterEach):

```typescript
test.beforeEach(async ({ page }, testInfo) => {
  await getReportData(page, testInfo);
  setupApiCollector(page, testInfo);
});

test.afterEach(async ({ page }, testInfo) => {  // ❌ Нужно добавлять везде!
  await sendCollectedData(page, testInfo);
});
```

### Стало (БЕЗ afterEach):

```typescript
import { setupApiCollector } from '@your-company/api-codegen';

test.beforeEach(async ({ page }, testInfo) => {
  await getReportData(page, testInfo);
  setupApiCollector(page, testInfo);  // Всё! Больше ничего не нужно!
});

// afterEach НЕ НУЖЕН - данные отправляются автоматически! ✅
```

---

## Как работает Batch отправка

### Настройки по умолчанию:

```typescript
{
  batchSize: 20,        // Отправлять каждые 20 запросов
  sendInterval: 5000    // Или каждые 5 секунд
}
```

### Workflow:

```
Тест начался
  ↓
Собрано 20 запросов → 📤 Отправка batch #1
  ↓
Прошло 5 секунд → 📤 Отправка batch #2 (если есть данные)
  ↓
Собрано ещё 20 → 📤 Отправка batch #3
  ↓
Тест завершился → 📤 Отправка остатков (batch #4)
```

### Пример теста с 150 запросами:

```typescript
test('большой тест', async ({ page }) => {
  await page.goto('/dashboard');  // 50 запросов → batch #1, #2
  // Автоматически отправлено 40 запросов (2 batch'а)
  
  await page.click('#load-more');  // 50 запросов → batch #3, #4
  // Автоматически отправлено ещё 40 запросов
  
  await page.click('#refresh');    // 50 запросов → batch #5, #6
  // Автоматически отправлено ещё 40 запросов
  
  // Тест завершается
  // Автоматически отправляются остатки: 30 запросов (batch #7)
});

// Результат: 7 batch'ей по ~20 запросов
// Нет проблем с "entity too large"!
```

---

## Логи

```
[API Collector] 🔍 Начинаю сбор для: большой тест
[API Collector] ⚙️  Batch: 20 запросов, интервал: 5000ms

[API Collector] ✓ GET /api/v1/dashboard -> 200 (buffer: 1)
[API Collector] ✓ GET /api/v1/widgets -> 200 (buffer: 2)
...
[API Collector] ✓ GET /api/v1/users -> 200 (buffer: 20)

[API Collector] 📤 Отправляю batch: 20 записей (всего: 20)
[API Collector] ✅ Отправлено: 20 записей

[API Collector] ✓ POST /api/v1/update -> 201 (buffer: 1)
...
[API Collector] ✓ GET /api/v1/stats -> 200 (buffer: 15)

[API Collector] 📤 Отправляю batch: 15 записей (всего: 35)
[API Collector] ✅ Отправлено: 15 записей

[API Collector] 🎯 Всего собрано и отправлено: 150 запросов
```

---

## Настройка batch'ей

### Для быстрых тестов (мало запросов):

```typescript
setupApiCollector(page, testInfo, {
  batchSize: 10,        // Меньший batch
  sendInterval: 3000,   // Чаще отправляем
  verbose: true
});
```

### Для медленных тестов (много запросов):

```typescript
setupApiCollector(page, testInfo, {
  batchSize: 50,        // Больший batch
  sendInterval: 10000,  // Реже отправляем (экономим HTTP запросы)
  verbose: false
});
```

### Баланс (рекомендуется):

```typescript
setupApiCollector(page, testInfo, {
  batchSize: 20,        // Default
  sendInterval: 5000,   // Default
  verbose: true
});
```

---

## Полный пример

```typescript
// tests/cart.spec.ts
import { test } from '@playwright/test';
import { setupApiCollector } from '@your-company/api-codegen';

test.describe('Корзина', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await getReportData(page, testInfo);
    
    setupApiCollector(page, testInfo, {
      serviceUrl: process.env.API_COLLECTOR_URL,
      urlFilters: ['/api/v1/'],
      excludeUrls: ['/health', '/metrics'],
      batchSize: 20,
      sendInterval: 5000,
      verbose: true
    });
  });
  
  // afterEach НЕ НУЖЕН!
  
  test('добавление 100 товаров', async ({ page }) => {
    await page.goto('/products');
    
    for (let i = 0; i < 100; i++) {
      await page.click(`[data-product="${i}"] button`);
      // Каждый клик = 2-3 API запроса
      // Всего ~250 запросов
      
      // Автоматически отправляются batch'и:
      // Batch #1: 20 запросов
      // Batch #2: 20 запросов
      // ...
      // Batch #12: 20 запросов
      // Batch #13: 10 запросов (остатки)
    }
    
    // Тест завершается
    // Последний batch отправляется автоматически
  });
});
```

---

## Преимущества

### 1. Нет "entity too large"

**Было:**
```
POST /api/collect-data
Body: 300 запросов (2MB)
→ 413 Entity Too Large ❌
```

**Стало:**
```
POST /api/collect-data
Body: 20 запросов (150KB)
→ 200 OK ✅

POST /api/collect-data
Body: 20 запросов (150KB)
→ 200 OK ✅

... (15 batch'ей)

POST /api/collect-data
Body: 10 запросов (75KB)
→ 200 OK ✅
```

### 2. Не нужен afterEach

**Было:**
```typescript
// 200+ файлов тестов
test.afterEach(...) // Добавлять вручную везде ❌
```

**Стало:**
```typescript
// Только в beforeEach (уже есть)
setupApiCollector(...) // Всё! ✅
```

### 3. Отправка в реальном времени

- Данные не теряются при падении теста
- Меньше нагрузка на память
- Быстрее получаем данные в БД

### 4. Надёжность

- Retry при ошибке отправки
- Финальная отправка остатков
- Артефакт Playwright со статистикой

---

## Конфигурация

### Базовая (defaults):

```typescript
setupApiCollector(page, testInfo);
```

### С кастомными batch'ами:

```typescript
setupApiCollector(page, testInfo, {
  batchSize: 30,
  sendInterval: 8000
});
```

### Полная:

```typescript
setupApiCollector(page, testInfo, {
  serviceUrl: 'http://192.168.1.100:3000',
  endpoint: '/api/collect-data',
  urlFilters: ['/api/v1/', '/api/v2/'],
  excludeUrls: ['/health', '/metrics', '/ping'],
  batchSize: 20,
  sendInterval: 5000,
  verbose: true
});
```

### С предустановкой:

```typescript
// test-helpers/api-collector.ts
import { createCollector } from '@your-company/api-codegen';

export const apiCollector = createCollector({
  serviceUrl: process.env.API_COLLECTOR_URL,
  batchSize: 25,
  sendInterval: 6000,
  verbose: process.env.CI !== 'true'
});

// tests/example.spec.ts
test.beforeEach(async ({ page }, testInfo) => {
  await getReportData(page, testInfo);
  apiCollector.setup(page, testInfo);  // Всё!
});
```

---

## Troubleshooting

### Данные не отправляются

**Проверка 1:** Размер batch слишком большой?

```typescript
setupApiCollector(page, testInfo, {
  batchSize: 10,      // Уменьшите
  sendInterval: 2000, // Чаще отправляйте
  verbose: true       // Смотрите логи
});
```

**Проверка 2:** Сервис доступен?

```bash
curl http://192.168.1.100:3000/health
```

### Слишком много HTTP запросов

**Решение:** Увеличьте batch и интервал

```typescript
setupApiCollector(page, testInfo, {
  batchSize: 50,       // Больше
  sendInterval: 15000  // Реже
});
```

### Тест завершается раньше отправки

**Решение:** Уменьшите batch для быстрых тестов

```typescript
setupApiCollector(page, testInfo, {
  batchSize: 5,       // Маленький batch
  sendInterval: 1000  // Частая отправка
});
```

---

## Миграция

### Если у вас уже есть afterEach:

```typescript
// Старый код
test.afterEach(async ({ page }, testInfo) => {
  await sendCollectedData(page, testInfo);
});
```

**Просто удалите его!**

```typescript
// Новый код
// (ничего не нужно)
```

Данные будут отправляться автоматически!

---

## Статистика

В конце теста создаётся артефакт:

```json
{
  "totalCollected": 237,
  "testName": "большой тест",
  "testFile": "/tests/dashboard.spec.ts"
}
```

Смотреть в `test-results/`:

```bash
cat test-results/.../api-collector-summary.json
```

---

## ✅ Итого

- ✅ **Batch отправка** - по 20 запросов
- ✅ **Автоматически** - каждые 5 секунд
- ✅ **БЕЗ afterEach** - только beforeEach
- ✅ **Нет entity too large** - маленькие порции
- ✅ **В реальном времени** - данные не теряются
- ✅ **Настраиваемо** - batchSize и sendInterval

**Production ready!** 🎉✨
