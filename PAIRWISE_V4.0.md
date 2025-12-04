# 🎉 Версия 4.0 - Позитивные и Pairwise тесты!

## ✨ Новые возможности

### 1. ✅ Позитивные тесты с реальными DTO

Генератор теперь анализирует DTO из сгенерированных API методов и создает **2 типа позитивных тестов**:

#### Тест 1: Только обязательные поля

Проверяет что API работает с минимальным набором данных:

```typescript
// ============================================
// ПОЗИТИВНЫЕ ТЕСТЫ
// ============================================

// Тестовые данные для позитивных тестов

// Объект с только обязательными полями
const requiredFieldsOnly = {
  name: 'Test Name', // TODO: заменить на актуальные данные
  photoUrls: ['https://example.com'] // TODO: заменить на актуальные данные
};

test(`POST с обязательными полями (${success}) @api @positive`, async ({ page }, testInfo) => {
  const response = await axios.post(process.env.StandURL + endpoint, requiredFieldsOnly, configApiHeaderAdmin);

  await expect(response.status).toBe(success);
  await expect(response.data).toBeDefined();
  // TODO: Добавить проверки обязательных полей в response
});
```

#### Тест 2: Все поля заполнены

Проверяет что API корректно обрабатывает полный набор данных:

```typescript
// Объект со всеми полями
const allFieldsFilled = {
  id: 1, // TODO: заменить на актуальные данные
  category: null, // TODO: заменить на актуальные данные
  name: 'Test Name', // TODO: заменить на актуальные данные
  photoUrls: ['https://example.com'], // TODO: заменить на актуальные данные
  tags: [], // TODO: заменить на актуальные данные
  status: 'available' // TODO: заменить на актуальные данные
};

test(`POST со всеми полями (${success}) @api @positive`, async ({ page }, testInfo) => {
  const response = await axios.post(process.env.StandURL + endpoint, allFieldsFilled, configApiHeaderAdmin);

  await expect(response.status).toBe(success);
  await expect(response.data).toBeDefined();
  // TODO: Добавить проверки всех полей в response
});
```

### 2. 🆕 Pairwise тесты (комбинаторное покрытие)

Генератор создает **2 типа pairwise тестов**:

#### Тип 1: Комбинации необязательных полей

Генерируется 5-10 тестов с различными комбинациями необязательных полей:

```typescript
// ============================================
// PAIRWISE ТЕСТЫ
// ============================================

// Тестовые данные для pairwise тестов

// Комбинация 1: обязательные поля + id
const pairwiseCombo1 = {
  name: 'Test Name',
  photoUrls: ['https://example.com'],
  id: 1
};

// Комбинация 2: обязательные поля + id, category
const pairwiseCombo2 = {
  name: 'Test Name',
  photoUrls: ['https://example.com'],
  id: 1,
  category: null
};

// Комбинация 3: обязательные поля + id, category, tags
const pairwiseCombo3 = {
  name: 'Test Name',
  photoUrls: ['https://example.com'],
  id: 1,
  category: null,
  tags: []
};

// Тип 1: Комбинации необязательных полей

test(`POST pairwise комбинация 1 (${success}) @api @pairwise`, async ({ page }, testInfo) => {
  const response = await axios.post(process.env.StandURL + endpoint, pairwiseCombo1, configApiHeaderAdmin);

  await expect(response.status).toBe(success);
  await expect(response.data).toBeDefined();
});

test(`POST pairwise комбинация 2 (${success}) @api @pairwise`, async ({ page }, testInfo) => {
  const response = await axios.post(process.env.StandURL + endpoint, pairwiseCombo2, configApiHeaderAdmin);

  await expect(response.status).toBe(success);
  await expect(response.data).toBeDefined();
});
```

#### Тип 2: Различные значения enum полей

Для полей с enum значениями генерируются отдельные тесты:

```typescript
// Тест с status = 'available'
const pairwiseEnum_status_1 = {
  name: 'Test Name',
  photoUrls: ['https://example.com'],
  status: 'available'
};

// Тест с status = 'pending'
const pairwiseEnum_status_2 = {
  name: 'Test Name',
  photoUrls: ['https://example.com'],
  status: 'pending'
};

// Тест с status = 'sold'
const pairwiseEnum_status_3 = {
  name: 'Test Name',
  photoUrls: ['https://example.com'],
  status: 'sold'
};

// Тип 2: Различные значения enum полей

test(`POST с status='available' (${success}) @api @pairwise`, async ({ page }, testInfo) => {
  const response = await axios.post(process.env.StandURL + endpoint, pairwiseEnum_status_1, configApiHeaderAdmin);

  await expect(response.status).toBe(success);
  await expect(response.data).toBeDefined();
});

test(`POST с status='pending' (${success}) @api @pairwise`, async ({ page }, testInfo) => {
  const response = await axios.post(process.env.StandURL + endpoint, pairwiseEnum_status_2, configApiHeaderAdmin);

  await expect(response.status).toBe(success);
  await expect(response.data).toBeDefined();
});
```

## 📖 Структура сгенерированного теста

Тест теперь разделен на 3 секции с комментариями:

```typescript
test.describe(`API тесты для эндпоинта ${httpMethod} >> ${endpoint}`, async () => {

  // ============================================
  // НЕГАТИВНЫЕ ТЕСТЫ
  // ============================================
  
  test('POST без TOKEN (401) @api', async ({ page }, testInfo) => {
    // ...
  });
  
  test('POST с токеном без Body (400) @api', async ({ page }, testInfo) => {
    // ...
  });
  
  // ... остальные негативные тесты

  // ============================================
  // ПОЗИТИВНЫЕ ТЕСТЫ
  // ============================================
  
  // Тестовые данные для позитивных тестов
  const requiredFieldsOnly = { /* ... */ };
  const allFieldsFilled = { /* ... */ };
  
  test('POST с обязательными полями (201) @api @positive', async ({ page }, testInfo) => {
    // ...
  });
  
  test('POST со всеми полями (201) @api @positive', async ({ page }, testInfo) => {
    // ...
  });

  // ============================================
  // PAIRWISE ТЕСТЫ
  // ============================================
  
  // Тестовые данные для pairwise тестов
  const pairwiseCombo1 = { /* ... */ };
  const pairwiseCombo2 = { /* ... */ };
  // ...
  
  // Тип 1: Комбинации необязательных полей
  test('POST pairwise комбинация 1 (201) @api @pairwise', async ({ page }, testInfo) => {
    // ...
  });
  
  // Тип 2: Различные значения enum полей
  test('POST с status=\'available\' (201) @api @pairwise', async ({ page }, testInfo) => {
    // ...
  });

});
```

## 🚀 Использование

### Генерация всех типов тестов

```typescript
import { generateApiTests } from 'openapi-typescript-generator';

await generateApiTests({
  apiFilePath: './src/api/preorders.api.ts',
  outputDir: './tests/api/preorders/',
  baseTestPath: '../../../fixtures/baseTest',
  axiosHelpersPath: '../../../helpers/axiosHelpers',
  
  // Опции генерации
  generateNegativeTests: true,  // 401, 403, 400, 405, 415, 404
  generatePositiveTests: true,  // Обязательные поля + все поля
  generatePairwiseTests: true,  // Комбинации полей + enum значения
});
```

### Селективная генерация

```typescript
// Только негативные тесты
await generateApiTests({
  apiFilePath: './src/api/users.api.ts',
  outputDir: './tests/api/users/',
  generateNegativeTests: true,
  generatePositiveTests: false,
  generatePairwiseTests: false,
});

// Только позитивные и pairwise
await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders/',
  generateNegativeTests: false,
  generatePositiveTests: true,
  generatePairwiseTests: true,
});
```

## 🎯 Анализ DTO и умная генерация

### Автоматическое определение типов полей

Генератор анализирует DTO и создает адекватные моковые данные:

```typescript
export interface CreateOrderRequest {
  email: string;          // → 'test@example.com'
  userName: string;       // → 'Test Name'
  age: number;            // → 100
  isActive: boolean;      // → true
  registrationDate: Date; // → '2024-01-01'
  tags: string[];         // → ['test']
  status: 'active' | 'pending' | 'closed'; // → 'active'
}
```

### Определение обязательных полей

Генератор различает обязательные и необязательные поля:

```typescript
export interface Pet {
  id?: number;           // Необязательное
  name: string;          // Обязательное
  photoUrls: string[];   // Обязательное
  status?: 'available' | 'pending' | 'sold'; // Необязательное, enum
}
```

**Результат:**
- `requiredFieldsOnly`: только `name` и `photoUrls`
- `allFieldsFilled`: все поля включая `id` и `status`
- Pairwise комбинации: различные сочетания `id` и `status`

### Поддержка enum типов

Для enum полей генерируются отдельные тесты для каждого значения:

```typescript
status?: 'available' | 'pending' | 'sold';

// →

const pairwiseEnum_status_1 = { ..., status: 'available' };
const pairwiseEnum_status_2 = { ..., status: 'pending' };
const pairwiseEnum_status_3 = { ..., status: 'sold' };
```

## 📊 Статистика покрытия

Для одного POST endpoint с 6 полями (2 обязательных, 4 необязательных, 1 enum с 3 значениями):

**Негативные тесты:** 7-8 тестов
- 401 - Без токена
- 400 - Без body
- 405 - Method Not Allowed (×3)
- 403 - Без прав
- 415 - Неверный Content-Type

**Позитивные тесты:** 2 теста
- С обязательными полями
- Со всеми полями

**Pairwise тесты:** 7 тестов
- 4 комбинации необязательных полей
- 3 теста с разными enum значениями

**Итого:** 16-17 тестов на один endpoint! 🎉

## 💡 Удобство использования

### Все данные в начале файла

Все тестовые объекты вынесены в начало секций с комментариями:

```typescript
// Тестовые данные для позитивных тестов

// Объект с только обязательными полями
const requiredFieldsOnly = {
  name: 'Test Name', // TODO: заменить на актуальные данные
  photoUrls: ['https://example.com'] // TODO: заменить на актуальные данные
};

// Объект со всеми полями
const allFieldsFilled = {
  id: 1, // TODO: заменить на актуальные данные
  category: null, // TODO: заменить на актуальные данные
  name: 'Test Name', // TODO: заменить на актуальные данные
  // ...
};
```

Легко найти и обновить данные под конкретный стенд!

### Теги для фильтрации

```bash
# Все тесты
npx playwright test

# Только негативные
npx playwright test --grep @api

# Только позитивные
npx playwright test --grep @positive

# Только pairwise
npx playwright test --grep @pairwise

# Позитивные + pairwise
npx playwright test --grep "@positive|@pairwise"
```

## 🎁 Дополнительные улучшения

### 1. Поддержка вложенных объектов

Если поле имеет тип объекта:

```typescript
category?: Category;
```

Генератор создаст:
```typescript
category: null // TODO: заменить на актуальные данные
```

### 2. Поддержка массивов

Для массивов создаются пустые или с одним элементом:

```typescript
tags?: Tag[];
```

Генератор создаст:
```typescript
tags: [] // TODO: заменить на актуальные данные
```

### 3. Умные моковые данные

Генератор анализирует имена полей:

- `email` → `'test@example.com'`
- `name` / `userName` → `'Test Name'`
- `url` → `'https://example.com'`
- `id` → `1`
- `date` / `createdAt` → `'2024-01-01'`

## 📥 Скачать

**[api-generator-v4.0-PAIRWISE.tar.gz](computer:///mnt/user-data/outputs/api-generator-v4.0-PAIRWISE.tar.gz)** - Версия с полной поддержкой позитивных и pairwise тестов!

## 🎯 Пример полного workflow

```typescript
// 1. Генерируем API из OpenAPI
await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './src/api',
  baseUrl: 'process.env.StandURL',
  authTokenVar: 'process.env.AUTH_TOKEN',
});

// 2. Генерируем тесты
await generateApiTests({
  apiFilePath: './src/api/preorders.api.ts',
  outputDir: './tests/api/preorders/',
  baseTestPath: '../../../fixtures/baseTest',
  axiosHelpersPath: '../../../helpers/axiosHelpers',
  generateNegativeTests: true,
  generatePositiveTests: true,
  generatePairwiseTests: true,
});

// 3. Обновляем тестовые данные под ваш стенд
// Редактируем requiredFieldsOnly, allFieldsFilled, pairwiseCombo1, etc.

// 4. Запускаем тесты
// npx playwright test tests/api/preorders/ --workers=10
```

## ✅ Что реализовано

- [x] Анализ DTO из сгенерированных методов
- [x] Позитивный тест с обязательными полями
- [x] Позитивный тест со всеми полями
- [x] Pairwise тесты - комбинации необязательных полей
- [x] Pairwise тесты - различные enum значения
- [x] Умная генерация моковых данных
- [x] Разделение тестов по секциям с комментариями
- [x] Вынос всех данных в начало секций
- [x] Теги @positive и @pairwise
- [x] TODO комментарии для актуализации данных

Генератор готов к production! 🚀

Следующий шаг: Можем добавить JSON Schema валидацию для проверки структуры response! 😊
