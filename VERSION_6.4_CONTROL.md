# 🎛️ Версия 6.4 - Управление этапами и детальностью логов

## ✅ Что добавлено

### 1. Управление этапами анализа

Теперь можно включать/выключать любой из 3 этапов:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  
  // 🆕 Управление этапами
  stages: {
    schemaAnalysis: true,   // Этап 1: Анализ схемы БД
    foreignKeys: false,     // Этап 2: Анализ Foreign Keys (выключен)
    empiricalTest: false    // Этап 3: Эмпирический тест (выключен)
  }
}, testDbConnect);
```

**Вывод:**

```
⚙️  Конфигурация этапов:
  Этап 1 (Schema Analysis): ✅ Включен
  Этап 2 (Foreign Keys): ❌ Выключен
  Этап 3 (Empirical Test): ❌ Выключен

📊 ЭТАП 1: Анализ схемы БД...
✓ Найдено подозрительных таблиц: 1
  - orders_schema.orders (confidence: 100%)

⏭️  ЭТАП 2: Пропущен (отключен в конфигурации)
⏭️  ЭТАП 3: Пропущен (отключен в конфигурации)

✓ Используется таблица с наивысшим confidence: orders_schema.orders (100%)
```

### 2. Токен авторизации для Этапа 3

Добавлена поддержка токена для HTTP запросов:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  
  // 🆕 Токен авторизации
  authToken: 'your_jwt_token_here',
  
  stages: {
    empiricalTest: true  // Теперь будет работать!
  }
}, testDbConnect);
```

**Вывод:**

```
🎯 ЭТАП 3: Эмпирический тест...
  📡 Вызываем POST https://dev.example.com/api/v1/orders
     ✓ Добавлен токен авторизации: Bearer your_jwt_to...
  ✓ Endpoint вызван успешно
```

**Без токена:**

```
  📡 Вызываем POST https://dev.example.com/api/v1/orders
     ⚠️  Токен авторизации не указан (может быть ошибка 401)
  ⚠️  Endpoint вернул ошибку: 401 Unauthorized
  💡 Ошибка 401 (Unauthorized) - добавьте authToken в конфигурацию
```

### 3. Управление детальностью логов

Включайте/выключайте детальные логи для каждого этапа:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  
  // 🆕 Управление детальностью
  verboseStages: {
    stage1: false,  // Этап 1: только итог
    stage2: false,  // Этап 2: только итог
    stage3: true    // Этап 3: все детали
  }
}, testDbConnect);
```

**С verbose: false (компактный вывод):**

```
📊 ЭТАП 1: Анализ схемы БД...
  ✓ Получено 487 колонок из БД
  ✓ Найдено 42 таблиц в БД
✓ Найдено подозрительных таблиц: 1
  - orders_schema.orders (confidence: 100%)
```

**С verbose: true (детальный вывод):**

```
📊 ЭТАП 1: Анализ схемы БД...
  ✓ Получено 487 колонок из БД
  ✓ Найдено 42 таблиц в БД

  🔎 ДЕТАЛЬНЫЙ АНАЛИЗ КАЖДОГО ПОЛЯ DTO:
  
  📌 Поле DTO: "orderType"
     Генерирую варианты: orderType, ordertype, order_type, ORDER_TYPE, ...
     ✓ НАЙДЕНО в таблице "orders_schema.orders": order_type

  📌 Поле DTO: "productId"
     Генерирую варианты: productId, productid, product_id, PRODUCT_ID, ...
     ✓ НАЙДЕНО в таблице "orders_schema.orders": product_id

  ╔═══════════════════════════════════════════════════════════════╗
  ║ 🎯 ТАБЛИЦА: orders_schema.orders                              ║
  ║ Совпадений: 2/2 (100%)                                        ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║ ✓ orderType → order_type                                      ║
  ║ ✓ productId → product_id                                      ║
  ╚═══════════════════════════════════════════════════════════════╝
```

### 4. CURL команда для отладки (Этап 3)

При включенном `verboseStages.stage3` показывается CURL команда:

```
🎯 ЭТАП 3: Эмпирический тест...
  🎲 Сгенерированы уникальные данные:
     {
       "orderType": "TEST_1733843200000_ORDERTYPE",
       "productId": 999900000123456
     }

  📡 Вызываем POST https://dev.example.com/api/v1/orders
     ✓ Добавлен токен авторизации: Bearer your_jwt_to...

  📋 CURL команда для отладки:
  ┌─────────────────────────────────────────────────────────────────┐
  │ curl -X POST 'https://dev.example.com/api/v1/orders' \         │
  │   -H 'Content-Type: application/json' \                         │
  │   -H 'Authorization: Bearer your_jwt_token_here' \              │
  │   -d '{"orderType":"TEST_1733843200000_ORDERTYPE","product...   │
  └─────────────────────────────────────────────────────────────────┘

  ✓ Endpoint вызван успешно
```

Можно скопировать CURL и выполнить в терминале для отладки!

### 5. Умный fallback на Этап 1

Если Этап 3 не нашел данные (ошибка 401, 400, etc.), используется результат Этапа 1:

```
🎯 ЭТАП 3: Эмпирический тест...
  ⚠️  Endpoint вернул ошибку: 401 Unauthorized
  💡 Ошибка 401 (Unauthorized) - добавьте authToken в конфигурацию

⚠️  Таблицы не подтверждены (endpoint не создал данных или вернул ошибку)
💡 Используем таблицу с наивысшим confidence из Этапа 1

✓ Выбрана таблица: orders_schema.orders (100% confidence)
```

## 🎯 Сценарии использования

### Сценарий 1: Быстрый анализ (только Этап 1)

Самый быстрый способ - только Schema Analysis:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',  // Указываем схему
  
  stages: {
    schemaAnalysis: true,
    foreignKeys: false,      // ← Выключаем
    empiricalTest: false     // ← Выключаем
  },
  
  verboseStages: {
    stage1: false  // Только итог
  }
}, testDbConnect);
```

**Результат:**
- ⚡ Очень быстро (секунды)
- ✅ Находит таблицу с highest confidence
- 📊 Компактный вывод

### Сценарий 2: С проверкой FK (Этапы 1-2)

Находим основную таблицу + связанные:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  
  stages: {
    schemaAnalysis: true,
    foreignKeys: true,       // ← Включаем FK
    empiricalTest: false
  },
  
  verboseStages: {
    stage1: false,
    stage2: true   // Детали FK
  }
}, testDbConnect);
```

**Результат:**
- 📊 Находит orders + order_items + customers
- 🔗 Показывает связи между таблицами
- 💾 Генерирует данные для всех таблиц

### Сценарий 3: Полный анализ с токеном

Все 3 этапа с авторизацией:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  
  authToken: process.env.DEV_API_TOKEN,  // Из переменных окружения
  
  stages: {
    schemaAnalysis: true,
    foreignKeys: true,
    empiricalTest: true
  },
  
  verboseStages: {
    stage1: false,
    stage2: false,
    stage3: true   // Детали HTTP запроса
  }
}, testDbConnect);
```

**Результат:**
- ✅ Находит таблицы (Этап 1)
- 🔗 Находит связи (Этап 2)
- 🎯 Подтверждает реальным вызовом (Этап 3)
- 📋 Показывает CURL для отладки

### Сценарий 4: Отладка endpoint

Endpoint не работает - нужна максимальная информация:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  
  authToken: 'your_token',
  
  stages: {
    schemaAnalysis: true,
    foreignKeys: false,
    empiricalTest: true   // Только тестируем endpoint
  },
  
  verboseStages: {
    stage1: false,
    stage2: false,
    stage3: true   // ← Максимум информации
  }
}, testDbConnect);
```

**Вывод при ошибке 400:**

```
🎯 ЭТАП 3: Эмпирический тест...
  🎲 Сгенерированы уникальные данные:
     {
       "orderType": "TEST_...",
       "productId": 999900000...
     }

  📡 Вызываем POST https://dev.example.com/api/v1/orders
  
  📋 CURL команда для отладки:
  ┌────────────────────────────────────────────┐
  │ curl -X POST '...' \                       │
  │   -H 'Authorization: Bearer ...' \         │
  │   -d '{"orderType":"TEST_..."}'            │
  └────────────────────────────────────────────┘

  ⚠️  Endpoint вернул ошибку: 400 Bad Request
  💡 Ошибка 400 (Bad Request) - данные не прошли валидацию
     Ответ сервера: {
       "error": "Invalid productId",
       "details": "productId must be a valid existing product"
     }
```

Теперь видно что нужно исправить!

## 📋 Полный API

### DatabaseAnalyzerConfig

```typescript
interface DatabaseAnalyzerConfig {
  testFilePath: string;
  dbConnectionMethod: string;
  dbSchema?: string | null;
  force?: boolean;
  dataStrategy?: 'existing' | 'generate' | 'both';
  samplesCount?: number;
  
  // 🆕 Управление этапами
  stages?: {
    schemaAnalysis?: boolean;    // Этап 1: Анализ схемы БД
    foreignKeys?: boolean;        // Этап 2: Анализ Foreign Keys
    empiricalTest?: boolean;      // Этап 3: Эмпирический тест
  };
  
  // 🆕 Токен авторизации
  authToken?: string;
  
  // 🆕 Детальность логов
  verboseStages?: {
    stage1?: boolean;  // Детальные логи Этапа 1
    stage2?: boolean;  // Детальные логи Этапа 2
    stage3?: boolean;  // Детальные логи Этапа 3
  };
}
```

### Дефолтные значения

```typescript
{
  force: false,
  dataStrategy: 'existing',
  samplesCount: 5,
  dbSchema: null,
  
  stages: {
    schemaAnalysis: true,
    foreignKeys: true,
    empiricalTest: true
  },
  
  authToken: undefined,
  
  verboseStages: {
    stage1: true,
    stage2: true,
    stage3: true
  }
}
```

## 💡 Рекомендации

### 1. Разработка - быстрый режим

```typescript
// Быстро находим таблицу
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'known_schema',  // Указываем если знаете
  stages: {
    schemaAnalysis: true,
    foreignKeys: false,
    empiricalTest: false
  },
  verboseStages: {
    stage1: false  // Компактный вывод
  }
}, testDbConnect);
```

### 2. CI/CD - минимум логов

```typescript
// В CI выключаем все детали
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  verboseStages: {
    stage1: false,
    stage2: false,
    stage3: false
  }
}, testDbConnect);
```

### 3. Отладка - максимум информации

```typescript
// При проблемах включаем все
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  authToken: process.env.TOKEN,
  stages: {
    schemaAnalysis: true,
    foreignKeys: true,
    empiricalTest: true
  },
  verboseStages: {
    stage1: true,
    stage2: true,
    stage3: true  // ← CURL команда!
  }
}, testDbConnect);
```

### 4. Проверка endpoint - только Этап 3

```typescript
// Уже знаем таблицу, проверяем только endpoint
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',  // Таблица уже указана в файле
  dbConnectionMethod: 'testDbConnect',
  force: false,  // Используем существующую таблицу
  authToken: process.env.TOKEN,
  stages: {
    schemaAnalysis: false,
    foreignKeys: false,
    empiricalTest: true  // Только тестируем endpoint
  },
  verboseStages: {
    stage3: true  // С CURL командой
  }
}, testDbConnect);
```

## ✅ Готово!

Теперь у вас полный контроль:
- ✅ Включение/выключение любого этапа
- ✅ Токен авторизации для HTTP запросов
- ✅ CURL команда для отладки
- ✅ Управление детальностью логов
- ✅ Умный fallback на highest confidence
- ✅ Компактный вывод для CI/CD

Настройте под свои нужды! 🎊
