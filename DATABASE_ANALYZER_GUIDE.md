# 🎯 Database Analyzer - Автоматическая генерация тестовых данных

## 📖 Обзор

Новый метод `analyzeAndGenerateTestData` автоматически анализирует тесты, находит связанные таблицы БД и генерирует реальные тестовые данные.

## 🚀 3-этапный процесс генерации

### Этап 1: Генерация API методов

```typescript
import { generateApi } from 'openapi-typescript-generator';

await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './src/api',
  baseUrl: 'process.env.StandURL',
});

// Результат: ./src/api/orders.api.ts
// Методы теперь возвращают response, а не response.data!
```

### Этап 2: Генерация API тестов

```typescript
import { generateApiTests } from 'openapi-typescript-generator';

await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders/',
});

// Результат: ./tests/api/orders/createOrder.test.ts
// В тестах теперь есть информация о DTO и placeholder для таблиц БД!
```

**Пример сгенерированного теста:**

```typescript
import test, { expect } from '../../../fixtures/baseTest';
import axios from 'axios';
import { configApiHeaderAdmin } from '../../../helpers/axiosHelpers';

const endpoint = '/api/v1/orders';
const httpMethod = 'POST';

// DTO информация
const dtoName = 'CreateOrderRequest';
const dtoPath = './src/api/orders.api.ts';

// Таблицы БД (автоматически определяется DatabaseAnalyzer)
// @db-tables:start
const dbTables: string[] = []; // Будет заполнено после анализа БД
// @db-tables:end

// Коды статусов
const apiErrorCodes = { /* ... */ };

test.describe(`API тесты для эндпоинта ${httpMethod} >> ${endpoint}`, async () => {
  // ... тесты
});
```

### Этап 3: Анализ БД и генерация данных 🆕

```typescript
import { analyzeAndGenerateTestData } from 'openapi-typescript-generator';
import { testDbConnect } from './helpers/dbConnection'; // Ваш метод подключения

await analyzeAndGenerateTestData(
  {
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    force: false, // Заново искать таблицы?
    dataStrategy: 'existing', // 'existing' | 'generate' | 'both'
    samplesCount: 5 // Количество примеров
  },
  testDbConnect // Передаем функцию подключения
);
```

**Вывод:**

```
🔍 Начинаю анализ теста и БД...
📄 Тест файл: ./tests/api/orders/createOrder.test.ts
✓ Извлечена информация о тесте
  Endpoint: POST /api/v1/orders
  DTO: CreateOrderRequest
✓ Извлечены поля DTO: customerId, items, totalAmount, status

📊 ЭТАП 1: Анализ схемы БД...
✓ Найдено подозрительных таблиц: 3
  - orders (confidence: 75%)
  - order_items (confidence: 50%)
  - order_statuses (confidence: 25%)

🔗 ЭТАП 2: Анализ Foreign Keys...
✓ Найдено связанных таблиц: 2
  - customers
  - products

🎯 ЭТАП 3: Эмпирический тест...
  📸 Снимаем snapshot таблиц...
  🎲 Сгенерированы уникальные данные
  📡 Вызываем POST /api/v1/orders...
  ✓ Endpoint вызван успешно
  📸 Снимаем snapshot после вызова...
✓ Подтверждено таблиц: 2
  - orders
  - order_items

💾 Генерация тестовых данных...
  ✓ orders: 5 записей из БД
  ✓ order_items: 5 записей из БД
✓ Сгенерированы данные для 2 таблиц
✓ Тест файл обновлен
```

**Обновленный тест:**

```typescript
const endpoint = '/api/v1/orders';
const httpMethod = 'POST';

// DTO информация
const dtoName = 'CreateOrderRequest';
const dtoPath = './src/api/orders.api.ts';

// Таблицы БД (автоматически определяется DatabaseAnalyzer)
// @db-tables:start
const dbTables: string[] = ['orders', 'order_items'];
// @db-tables:end

// @test-data:start
// Тестовые данные из БД (автоматически сгенерировано)
/* @protected:start:dbTestData */
const dbTestData = {
  orders: [
    {
      "id": 12345,
      "customer_id": 100,
      "total_amount": 599.99,
      "status": "pending",
      "order_date": "2024-12-01T10:30:00.000Z"
    },
    {
      "id": 12346,
      "customer_id": 101,
      "total_amount": 1299.50,
      "status": "completed",
      "order_date": "2024-12-02T14:20:00.000Z"
    },
    // ... еще 3 записи
  ],
  order_items: [
    {
      "id": 5001,
      "order_id": 12345,
      "product_id": 200,
      "quantity": 2,
      "price": 299.99
    },
    {
      "id": 5002,
      "order_id": 12345,
      "product_id": 201,
      "quantity": 1,
      "price": 299.99
    },
    // ... еще 3 записи
  ]
};
/* @protected:end:dbTestData */
// @test-data:end

test.describe(`API тесты`, async () => {
  test('POST с реальными данными из БД', async () => {
    const testOrder = dbTestData.orders[0];
    
    const response = await axios.post(
      process.env.StandURL + endpoint,
      {
        customerId: testOrder.customer_id,
        items: dbTestData.order_items.filter(i => i.order_id === testOrder.id),
        totalAmount: testOrder.total_amount,
        status: testOrder.status
      },
      configApiHeaderAdmin
    );
    
    await expect(response.status).toBe(201);
    await expect(response.data.id).toBeDefined();
  });
});
```

## 📋 API

### `analyzeAndGenerateTestData(config, dbConnectFunction)`

#### Параметры:

**config: DatabaseAnalyzerConfig**

```typescript
{
  // Путь к тест файлу
  testFilePath: string;
  
  // Имя метода для подключения к БД
  dbConnectionMethod: string;
  
  // Force режим (заново искать таблицы)
  force?: boolean; // default: false
  
  // Стратегия данных
  dataStrategy?: 'existing' | 'generate' | 'both'; // default: 'existing'
  
  // Количество примеров
  samplesCount?: number; // default: 5
}
```

**dbConnectFunction**

Функция подключения к БД (postgres template literal function).

Пример вашего метода:

```typescript
import postgres from 'postgres';

export const testDbConnect = postgres({
  host: 'localhost',
  port: 5432,
  database: 'test_db',
  username: 'test_user',
  password: 'test_password'
});

// Использование:
const result = await testDbConnect`
  SELECT * FROM orders WHERE id = ${orderId}
`;
```

#### Возвращает:

```typescript
{
  endpoint: string;              // '/api/v1/orders'
  confirmedTables: string[];     // ['orders', 'order_items']
  suspectedTables: string[];     // ['orders', 'order_items', 'order_statuses']
  relatedTables: string[];       // ['customers', 'products']
  testData: Record<string, any[]>; // Тестовые данные
}
```

## 🎯 Как это работает

### Этап 1: Schema Analysis (быстрый фильтр)

Анализатор:
1. Читает тест файл
2. Извлекает DTO имя и путь
3. Читает DTO и извлекает поля
4. Генерирует варианты имен полей:
   - `customerId` → `customer_id`, `customerid`, `customer_ids`
   - `items` → `items`, `item`
   - `totalAmount` → `total_amount`, `totalamount`
5. Ищет совпадения в схеме БД
6. Возвращает таблицы с confidence > 30%

### Этап 2: FK Analysis (расширение списка)

Для каждой найденной таблицы:
1. Находит прямые FK (куда ссылается таблица)
2. Находит обратные FK (кто ссылается на таблицу)
3. Добавляет связанные таблицы в список

### Этап 3: Empirical Test (финальная проверка)

1. **Snapshot ДО вызова**: Читает последние 10 строк из каждой подозрительной таблицы
2. **Генерация данных**: Создает уникальные тестовые данные с timestamp
   ```typescript
   {
     customerId: 999900000 + timestamp,
     email: `test_${timestamp}@analyzer.test`,
     name: `TEST_${timestamp}_NAME`,
     totalAmount: 999.99 + timestamp
   }
   ```
3. **Вызов endpoint**: Отправляет POST/PUT запрос с уникальными данными
4. **Snapshot ПОСЛЕ вызова**: Читает таблицы еще раз
5. **Детект изменений**: Ищет новые строки с нашими уникальными значениями
6. **Результат**: Таблицы где найдены наши данные = подтверждены!

### Генерация тестовых данных

Стратегии:

**existing** (по умолчанию):
```sql
SELECT * FROM orders
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 5
```

**generate** (пока не реализовано):
- Анализирует FK
- Генерирует валидные данные
- Вставляет в БД
- Возвращает созданные записи

**both**:
- Использует existing
- Дополняет generated если недостаточно

## 🔧 Настройка подключения к БД

### Вариант 1: Отдельный файл

```typescript
// helpers/dbConnection.ts
import postgres from 'postgres';

export const testDbConnect = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'test_db',
  username: process.env.DB_USER || 'test_user',
  password: process.env.DB_PASS || 'test_password',
  max: 10, // Максимум 10 соединений
  idle_timeout: 20,
  connect_timeout: 10,
});
```

### Вариант 2: В конфиге проекта

```typescript
// config/database.ts
import postgres from 'postgres';

const connections = {
  dev: postgres({ host: 'dev-db.company.com', ... }),
  staging: postgres({ host: 'staging-db.company.com', ... }),
  test: postgres({ host: 'test-db.company.com', ... }),
};

export const testDbConnect = connections[process.env.ENV || 'test'];
```

### Использование в анализаторе

```typescript
import { analyzeAndGenerateTestData } from 'openapi-typescript-generator';
import { testDbConnect } from './helpers/dbConnection';

// Передаем функцию как есть
await analyzeAndGenerateTestData(
  { testFilePath: './tests/api/orders/createOrder.test.ts', dbConnectionMethod: 'testDbConnect' },
  testDbConnect
);
```

## 🎨 Примеры использования

### Пример 1: Анализ одного теста

```typescript
import { analyzeAndGenerateTestData } from 'openapi-typescript-generator';
import { testDbConnect } from './helpers/dbConnection';

const result = await analyzeAndGenerateTestData(
  {
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    dataStrategy: 'existing',
    samplesCount: 10
  },
  testDbConnect
);

console.log('Найденные таблицы:', result.confirmedTables);
console.log('Тестовые данные:', result.testData);
```

### Пример 2: Массовый анализ всех тестов

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { analyzeAndGenerateTestData } from 'openapi-typescript-generator';
import { testDbConnect } from './helpers/dbConnection';

async function analyzeAllTests() {
  const testsDir = './tests/api';
  const testFiles: string[] = [];
  
  // Рекурсивно ищем все .test.ts файлы
  function findTestFiles(dir: string) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findTestFiles(fullPath);
      } else if (file.endsWith('.test.ts')) {
        testFiles.push(fullPath);
      }
    }
  }
  
  findTestFiles(testsDir);
  
  console.log(`Найдено тестов: ${testFiles.length}`);
  
  for (const testFile of testFiles) {
    console.log(`\n━━━ Анализирую: ${testFile} ━━━`);
    
    try {
      await analyzeAndGenerateTestData(
        {
          testFilePath: testFile,
          dbConnectionMethod: 'testDbConnect',
          force: false, // Не переписываем если уже есть
          dataStrategy: 'existing',
          samplesCount: 5
        },
        testDbConnect
      );
    } catch (error) {
      console.error(`❌ Ошибка: ${error.message}`);
    }
  }
}

analyzeAllTests();
```

### Пример 3: Force обновление после изменения схемы БД

```typescript
// После миграции БД обновляем все тесты
await analyzeAndGenerateTestData(
  {
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    force: true, // ← Заново ищем таблицы!
    dataStrategy: 'existing',
    samplesCount: 5
  },
  testDbConnect
);
```

### Пример 4: Интеграция в CI/CD

```typescript
// scripts/update-test-data.ts
import { analyzeAndGenerateTestData } from 'openapi-typescript-generator';
import { testDbConnect } from '../helpers/dbConnection';

async function updateTestData() {
  const testsToUpdate = process.argv.slice(2);
  
  if (testsToUpdate.length === 0) {
    console.error('Usage: npm run update-test-data <test1.ts> <test2.ts>');
    process.exit(1);
  }
  
  for (const test of testsToUpdate) {
    console.log(`Обновляю ${test}...`);
    
    await analyzeAndGenerateTestData(
      {
        testFilePath: test,
        dbConnectionMethod: 'testDbConnect',
        force: true,
        dataStrategy: 'existing',
        samplesCount: 10
      },
      testDbConnect
    );
  }
  
  console.log('✅ Готово!');
}

updateTestData();
```

```bash
# В package.json
{
  "scripts": {
    "update-test-data": "ts-node scripts/update-test-data.ts"
  }
}

# Использование
npm run update-test-data tests/api/orders/*.test.ts
```

## 🛡️ Protected области

Тестовые данные автоматически оборачиваются в protected область:

```typescript
/* @protected:start:dbTestData */
const dbTestData = {
  orders: [ /* ... */ ],
  order_items: [ /* ... */ ]
};
/* @protected:end:dbTestData */
```

При повторном запуске анализатора с `force: true`:
- Таблицы обновятся
- Данные в protected области **НЕ изменятся**

Если нужно обновить данные - удалите protected теги вручную.

## ⚙️ Конфигурация

### dataStrategy: 'existing'

```typescript
// Берет реальные данные из БД
const dbTestData = {
  orders: [
    { id: 12345, customer_id: 100, ... }, // Реальная запись
    { id: 12346, customer_id: 101, ... }  // Реальная запись
  ]
};
```

**Плюсы:**
- ✅ Реальные данные с prod/dev
- ✅ Быстро
- ✅ Валидные FK

**Минусы:**
- ❌ Может не быть данных в БД
- ❌ Данные могут измениться

### dataStrategy: 'generate' (TODO)

```typescript
// Генерирует новые данные и вставляет в БД
const dbTestData = {
  orders: [
    { id: 99001, customer_id: 99900, ... }, // Сгенерировано
    { id: 99002, customer_id: 99901, ... }  // Сгенерировано
  ]
};
```

**Плюсы:**
- ✅ Всегда есть данные
- ✅ Контролируемые значения
- ✅ Не зависит от prod

**Минусы:**
- ❌ Сложнее реализация
- ❌ Нужно соблюдать constraints

### dataStrategy: 'both'

Комбинация: берет existing, дополняет generate.

## 📊 Статистика и логи

Анализатор выводит детальные логи:

```
🔍 Начинаю анализ теста и БД...
📄 Тест файл: ./tests/api/orders/createOrder.test.ts
✓ Извлечена информация о тесте
  Endpoint: POST /api/v1/orders
  DTO: CreateOrderRequest
✓ Извлечены поля DTO: customerId, items, totalAmount, status

📊 ЭТАП 1: Анализ схемы БД...
✓ Найдено подозрительных таблиц: 3
  - orders (confidence: 75%)
  - order_items (confidence: 50%)
  - order_statuses (confidence: 25%)

🔗 ЭТАП 2: Анализ Foreign Keys...
✓ Найдено связанных таблиц: 2
  - customers
  - products

🎯 ЭТАП 3: Эмпирический тест...
  📸 Снимаем snapshot таблиц...
  🎲 Сгенерированы уникальные данные
  📡 Вызываем POST /api/v1/orders...
  ✓ Endpoint вызван успешно
  📸 Снимаем snapshot после вызова...
✓ Подтверждено таблиц: 2
  - orders
  - order_items

💾 Генерация тестовых данных...
  ✓ orders: 5 записей из БД
  ✓ order_items: 5 записей из БД
✓ Сгенерированы данные для 2 таблиц
✓ Тест файл обновлен
```

## ✅ Готово!

Теперь у вас есть полностью автоматизированная генерация:
1. ✅ API методов из OpenAPI
2. ✅ API тестов с информацией о DTO
3. ✅ Анализ БД и поиск таблиц
4. ✅ Реальные тестовые данные из БД

Все в 3 простых команды! 🚀
