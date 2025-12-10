# 🔧 Версия 6.1 - Исправления и улучшенное логирование

## ✅ Что исправлено

### 1. Детальное логирование Database Analyzer

Теперь анализатор выводит полную информацию на каждом этапе:

```
🔍 Начинаю анализ теста и БД...
📄 Тест файл: ./tests/api/orders/createOrder.test.ts

  🔍 Читаю тест файл...
  ✓ Файл прочитан, размер: 15432 символов
  ✓ Endpoint: /api/v1/orders
  ✓ HTTP Method: POST
  ✓ DTO Name: CreateOrderRequest
  ✓ DTO Path: ./src/api/base.types.ts
  ℹ️  Таблицы еще не определены

✓ Извлечена информация о тесте

  🔍 Читаю DTO из ./src/api/base.types.ts...
  ✓ Файл прочитан, размер: 8234 символов
  ✓ DTO найдено, парсим поля...
  ✓ Извлечено полей: 4
      - customerId
      - items
      - totalAmount
      - status

✓ Извлечены поля DTO: customerId, items, totalAmount, status

📊 ЭТАП 1: Анализ схемы БД...
  🔍 Ищу таблицы для полей: customerId, items, totalAmount, status
  ✓ Получено 487 колонок из БД
  ✓ Найдено 42 таблиц в БД
  📊 orders: 3/4 совпадений (75%)
      customerId → customer_id
      totalAmount → total_amount
      status → status
  📊 order_items: 2/4 совпадений (50%)
      items → items
      status → status

✓ Найдено подозрительных таблиц: 2
  - orders (confidence: 75%)
  - order_items (confidence: 50%)
```

### 2. Диагностика проблем

Если ничего не найдено, анализатор покажет причину:

```
📊 ЭТАП 1: Анализ схемы БД...
  🔍 Ищу таблицы для полей: customerId, items, totalAmount, status
  ✓ Получено 487 колонок из БД
  ✓ Найдено 42 таблиц в БД
  ⚠️  Совпадений не найдено. Проверьте naming convention.
  💡 Пример вариантов для поля "customerId":
      - customerId
      - customerid
      - customer_id
      - customer_ids
      - customerId_s
      - Id
      - id
```

### 3. Поддержка base.types.ts и импортов

Теперь анализатор автоматически ищет DTO в:
- Текущем файле (orders.api.ts)
- base.types.ts в той же папке
- Всех импортированных файлах

```typescript
// orders.api.ts
import { BaseResponse, CreateOrderRequest } from './base.types';
import { OrderStatus } from '../types/enums';

export async function createOrder(body: CreateOrderRequest): Promise<AxiosResponse<BaseResponse>> {
  // ...
}
```

При генерации тестов:

```
  📦 Найден base.types.ts, извлекаю DTO...
  ✓ Извлечено 15 DTO из base.types.ts
  📦 Читаю импорты из ../types/enums...
  ✓ Извлечено 3 DTO из ../types/enums
  📊 Всего доступно DTO: 18
  ✓ createOrder: найдено DTO 'CreateOrderRequest' в ./base.types.ts
```

В тесте:

```typescript
const endpoint = '/api/v1/orders';
const httpMethod = 'POST';

// DTO информация
const dtoName = 'CreateOrderRequest';
const dtoPath = './base.types.ts'; // ← Правильный путь!

// Таблицы БД
// @db-tables:start
const dbTables: string[] = [];
// @db-tables:end
```

### 4. Обработка ошибок

Детальные сообщения об ошибках:

```
  🔍 Читаю DTO из ./src/api/base.types.ts...
  ❌ Файл не найден: ./src/api/base.types.ts
```

```
  🔍 Читаю DTO из ./src/api/orders.api.ts...
  ✓ Файл прочитан, размер: 5432 символов
  ❌ DTO 'CreateOrderRequest' не найдено в файле
  💡 Ищу варианты в файле...
  📋 Найденные типы в файле:
      - export interface OrderResponse
      - export interface UpdateOrderRequest
      - export type OrderStatus
```

```
📊 ЭТАП 1: Анализ схемы БД...
  🔍 Ищу таблицы для полей: customerId, items
  ❌ Ошибка при чтении схемы БД: connect ECONNREFUSED 127.0.0.1:5432
  Stack: Error: connect ECONNREFUSED ...
```

## 🔍 Диагностика проблем

### Проблема: "Найдено подозрительных таблиц: 0"

**Возможные причины:**

#### 1. DTO не найдено

```
✓ Извлечена информация о тесте
  DTO: НЕ НАЙДЕНО
```

**Решение:** Убедитесь что в тесте есть:
```typescript
const dtoName = 'CreateOrderRequest';
const dtoPath = './src/api/orders.api.ts';
```

Если нет - перегенерируйте тесты с новой версией.

#### 2. Поля DTO не извлечены

```
✓ Извлечены поля DTO: 
  ℹ️  Поля DTO не найдены, пропускаю schema analysis
```

**Решение:** Проверьте что DTO существует в файле:

```bash
# Посмотрите что в файле
grep "export interface CreateOrderRequest" ./src/api/orders.api.ts

# Или в base.types.ts
grep "export interface CreateOrderRequest" ./src/api/base.types.ts
```

#### 3. Naming convention не совпадает

```
  ⚠️  Совпадений не найдено. Проверьте naming convention.
```

**Решение:** Посмотрите реальные имена колонок в БД:

```sql
-- Посмотрите колонки в предполагаемой таблице
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'orders';

-- Результат:
-- id
-- user_id       ← ваше DTO: customerId
-- order_items   ← ваше DTO: items
-- amount        ← ваше DTO: totalAmount
-- order_status  ← ваше DTO: status
```

Если naming сильно отличается, анализатор может не найти совпадения.

#### 4. Проблема с БД

```
  ❌ Ошибка при чтении схемы БД: connection refused
```

**Решение:** Проверьте подключение:

```typescript
// Тест подключения
import { testDbConnect } from './helpers/dbConnection';

try {
  const result = await testDbConnect`SELECT 1`;
  console.log('✓ БД доступна');
} catch (error) {
  console.error('❌ БД недоступна:', error.message);
}
```

### Проблема: "Подтверждено таблиц: 0" (но подозрительные найдены)

```
✓ Найдено подозрительных таблиц: 3
🎯 ЭТАП 3: Эмпирический тест...
  📡 Вызываем POST /api/v1/orders...
  ⚠️  Endpoint вернул ошибку: 400
  ℹ️  Продолжаем анализ (данные могли быть записаны)
✓ Подтверждено таблиц: 0
```

**Возможные причины:**

#### 1. Endpoint требует валидные данные

Анализатор генерирует тестовые данные, но они могут не проходить валидацию:

```typescript
// Сгенерировано:
{
  customerId: 999900000123456,
  items: "TEST_1733843200000_ITEMS",
  totalAmount: 1099.99,
  status: "TEST_STATUS_1733843200000"
}

// Но API ожидает:
{
  customerId: number (существующий ID),
  items: Array<{productId: number, quantity: number}>,
  totalAmount: number,
  status: "pending" | "completed" | "cancelled"
}
```

**Решение:** Это нормально! Используйте `force: false` при повторном запуске:

```typescript
// Первый запуск - ищем таблицы
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  force: true,
  dataStrategy: 'existing'
}, testDbConnect);

// Результат: нашли orders, order_items с 50% confidence

// Второй запуск - используем найденные таблицы
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  force: false, // ← Не вызываем endpoint!
  dataStrategy: 'existing'
}, testDbConnect);
```

#### 2. Endpoint не создает записи

GET endpoints не создают данные:

```typescript
// GET /api/v1/orders/{id}
// Не создаст новых записей в БД!
```

**Решение:** Для GET используйте только Schema Analysis:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/getOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  force: false, // Пропустить эмпирический тест
  dataStrategy: 'existing'
}, testDbConnect);
```

## 🎯 Рекомендации

### 1. Первый запуск - с force: true

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  force: true, // ← Ищем таблицы
  dataStrategy: 'existing',
  samplesCount: 5
}, testDbConnect);
```

Смотрим логи:
- Если "Найдено подозрительных таблиц: 0" → проблема с DTO или naming
- Если "Подтверждено таблиц: 0" → проблема с endpoint или данными
- Если всё ОК → таблицы найдены!

### 2. Повторные запуски - с force: false

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  force: false, // ← Используем существующие таблицы
  dataStrategy: 'existing',
  samplesCount: 10
}, testDbConnect);
```

Быстро, не вызывает endpoint.

### 3. Обновление после миграции - force: true

```typescript
// После изменения схемы БД
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  force: true, // ← Заново ищем таблицы
  dataStrategy: 'existing'
}, testDbConnect);
```

### 4. Массовый анализ

```typescript
import * as fs from 'fs';
import * as path from 'path';

function findTestFiles(dir: string): string[] {
  const files: string[] = [];
  
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (file.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const testFiles = findTestFiles('./tests/api');

for (const testFile of testFiles) {
  console.log(`\n━━━ ${testFile} ━━━`);
  
  try {
    await analyzeAndGenerateTestData({
      testFilePath: testFile,
      dbConnectionMethod: 'testDbConnect',
      force: false, // Быстрый режим
      dataStrategy: 'existing',
      samplesCount: 3
    }, testDbConnect);
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
  }
}
```

## 📊 Чеклист отладки

- [ ] База данных доступна (`SELECT 1` работает)
- [ ] Тесты содержат `dtoName` и `dtoPath`
- [ ] DTO существует в указанном файле
- [ ] Поля DTO извлечены корректно
- [ ] Naming convention совпадает (camelCase → snake_case)
- [ ] В БД есть данные в предполагаемых таблицах
- [ ] Endpoint доступен (если используете эмпирический тест)

## ✅ Готово!

Теперь анализатор выводит полную диагностическую информацию для отладки проблем! 🎊
