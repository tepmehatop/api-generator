# 🎉 Версия 5.0 - Умная перезапись и Protected области!

## ✅ Все исправления реализованы

### 1. ✅ Методы API возвращают response вместо response.data

**Было:**
```typescript
export async function getUserById(id: number): Promise<User> {
  const response = await httpClient.get(`/users/${id}`);
  return response.data; // ❌ Нельзя получить response.status
}
```

**Стало:**
```typescript
export async function getUserById(id: number): Promise<AxiosResponse<User>> {
  const response = await httpClient.get(`/users/${id}`);
  return response; // ✅ Полный доступ к response.status, response.headers, etc.
}
```

**Использование в тестах:**
```typescript
test('Проверка статуса', async () => {
  const response = await getUserById(1);
  
  // Теперь можно проверить статус!
  await expect(response.status).toBe(200);
  await expect(response.data).toBeDefined();
  await expect(response.headers['content-type']).toContain('application/json');
});
```

### 2. ✅ Автоматическая очистка папки при генерации API

**Было:** Нужно было вручную удалять папку перед генерацией

**Стало:** Генератор автоматически очищает папку

```typescript
await generateApi({
  specUrl: 'openapi.json',
  outputDir: './src/api', // ← Папка будет автоматически очищена!
});

// Вывод:
// 🚀 Начинаю генерацию API клиента...
// 🧹 Очищаю папку ./src/api...
// ✓ OpenAPI спецификация загружена
// ...
```

### 3. ✅ Умная перезапись тестов

**Было:** Нужно было вручную удалять тесты перед обновлением

**Стало:** Генератор обновляет существующие тесты

```typescript
await generateApiTests({
  apiFilePath: './src/api/users.api.ts',
  outputDir: './tests/api/users/',
});

// Вывод:
// 🧪 Начинаю генерацию API тестов...
// ✓ Найдено методов: 5
//   ✅ getUserById.test.ts (создан)
//   ♻️  createUser.test.ts (обновлен)
//   ⏭️  deleteUser.test.ts (пропущен - помечен как ReadOnly)
//
// ✨ Генерация завершена!
//    Создано: 1
//    Обновлено: 3
//    Пропущено: 1
```

### 4. 🆕 Protected области - сохранение тестовых данных

Вы можете пометить области в тестах которые не должны перезаписываться:

#### Многострочный синтаксис:

```typescript
test.describe(`API тесты для эндпоинта POST >> /api/v1/users`, async () => {

  /* @protected:start:testData */
  // Тестовые данные - НЕ будут перезаписаны при обновлении!
  
  const validUser = {
    name: 'John Doe',
    email: 'john.doe@company.com',
    role: 'admin',
    department: 'Engineering',
    permissions: ['read', 'write', 'delete']
  };
  
  const invalidUser = {
    name: '',
    email: 'invalid-email'
  };
  
  const userWithSpecialChars = {
    name: 'Тест Пользователь',
    email: 'test@тест.ru'
  };
  /* @protected:end:testData */

  test('POST с валидными данными', async () => {
    const response = await axios.post(url, validUser, config);
    await expect(response.status).toBe(201);
  });

});
```

#### Однострочный синтаксис:

```typescript
// @protected:start:customTests
test('Кастомный тест с особой логикой', async () => {
  // Этот тест не будет перезаписан
  const specialData = await prepareSpecialData();
  const response = await createUser(specialData);
  await customValidation(response);
});
// @protected:end:customTests
```

#### Множество protected областей:

```typescript
/* @protected:start:validData */
const validUser = { name: 'John', email: 'john@example.com' };
/* @protected:end:validData */

/* @protected:start:invalidData */
const invalidUsers = [
  { name: '', email: '' },
  { name: 'Test', email: 'invalid' },
  { name: null, email: null }
];
/* @protected:end:invalidData */

/* @protected:start:edgeCases */
const edgeCases = {
  veryLongName: 'A'.repeat(10000),
  unicodeChars: '测试用户',
  sqlInjection: "'; DROP TABLE users; --"
};
/* @protected:end:edgeCases */
```

### 5. 🆕 ReadOnly тег - полное исключение файла

Если тест полностью готов и не должен обновляться:

```typescript
// @readonly
// Этот тест полностью готов и НЕ должен обновляться!

import test, { expect } from '../../../fixtures/baseTest';
import axios from 'axios';

test.describe('Полностью готовый тест', async () => {
  // ... все тесты с готовыми данными
});
```

Или в начале файла:

```typescript
/* @readonly */
/* Этот файл не будет обновлен генератором */

import test, { expect } from '../../../fixtures/baseTest';
// ...
```

Альтернативные варианты тега:
- `@readonly`
- `@read-only`
- `@READONLY`

## 📖 Примеры использования

### Пример 1: Первая генерация

```typescript
// Первый запуск - создаются все тесты
await generateApiTests({
  apiFilePath: './src/api/users.api.ts',
  outputDir: './tests/api/users/',
});

// Результат:
// ✅ getUserById.test.ts (создан)
// ✅ createUser.test.ts (создан)
// ✅ updateUser.test.ts (создан)
// ✅ deleteUser.test.ts (создан)
```

### Пример 2: Добавляем тестовые данные

Редактируем `createUser.test.ts`:

```typescript
test.describe('API тесты для эндпоинта POST >> /api/v1/users', async () => {

  /* @protected:start:myData */
  // Мои готовые тестовые данные
  const validUser = {
    name: 'Actual User From Database',
    email: 'real.user@company.com',
    role: 'developer',
    teamId: 42 // Реальный ID команды на dev стенде
  };
  
  const adminUser = {
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    teamId: 1
  };
  /* @protected:end:myData */

  test('POST с валидными данными', async () => {
    const response = await axios.post(url, validUser, config);
    await expect(response.status).toBe(201);
  });

});
```

### Пример 3: Обновляем OpenAPI и перегенерируем

В OpenAPI добавили новое поле `phoneNumber` в DTO User:

```typescript
// Запускаем перегенерацию
await generateApi({
  specUrl: 'openapi.json',
  outputDir: './src/api', // ← Папка очистится автоматически
});

await generateApiTests({
  apiFilePath: './src/api/users.api.ts',
  outputDir: './tests/api/users/',
});

// Результат:
// ♻️  createUser.test.ts (обновлен)
```

Смотрим `createUser.test.ts`:

```typescript
test.describe('API тесты для эндпоинта POST >> /api/v1/users', async () => {

  /* @protected:start:myData */
  // Мои готовые тестовые данные - НЕ ИЗМЕНИЛИСЬ! ✅
  const validUser = {
    name: 'Actual User From Database',
    email: 'real.user@company.com',
    role: 'developer',
    teamId: 42
  };
  
  const adminUser = {
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    teamId: 1
  };
  /* @protected:end:myData */

  // Объект со всеми полями - ОБНОВЛЕН с новым полем! ✅
  const allFieldsFilled = {
    name: 'Test Name',
    email: 'test@example.com',
    role: 'user',
    teamId: 1,
    phoneNumber: 'test' // ← НОВОЕ ПОЛЕ ДОБАВЛЕНО!
  };

  test('POST с валидными данными', async () => {
    const response = await axios.post(url, validUser, config);
    await expect(response.status).toBe(201);
  });

});
```

### Пример 4: Полностью готовый тест

Когда тест полностью готов и не должен обновляться:

```typescript
// @readonly

import test, { expect } from '../../../fixtures/baseTest';
import axios from 'axios';
import { configApiHeaderAdmin } from '../../../helpers/axiosHelpers';

const endpoint = '/api/v1/orders';

// Готовые тестовые данные с реального стенда
const validOrder = {
  customerId: 12345,
  items: [
    { productId: 100, quantity: 2 },
    { productId: 101, quantity: 1 }
  ],
  deliveryAddress: {
    street: 'Main St',
    city: 'New York',
    zip: '10001'
  },
  paymentMethod: 'credit_card'
};

test.describe('Orders API - Production Ready Tests', async () => {
  // Все тесты с готовыми данными
  // ...
});
```

При обновлении:

```
⏭️  createOrder.test.ts (пропущен - помечен как ReadOnly)
```

## 🎯 Best Practices

### 1. Используйте protected для данных

```typescript
/* @protected:start:testData */
// Все тестовые данные здесь
const data1 = { /* ... */ };
const data2 = { /* ... */ };
/* @protected:end:testData */
```

### 2. Используйте @readonly для готовых тестов

```typescript
// @readonly
// Полностью готовый и протестированный файл
```

### 3. Используйте несколько protected областей

```typescript
/* @protected:start:validData */
// Валидные данные
/* @protected:end:validData */

/* @protected:start:invalidData */
// Невалидные данные
/* @protected:end:invalidData */

/* @protected:start:customTests */
// Кастомные тесты
/* @protected:end:customTests */
```

### 4. Не забывайте про ID в тегах

ID должен быть уникальным в пределах файла:

```typescript
/* @protected:start:data1 */
// ...
/* @protected:end:data1 */

/* @protected:start:data2 */
// ...
/* @protected:end:data2 */
```

## 🚀 Workflow с новыми функциями

### Начальная настройка

```bash
# 1. Генерация API
await generateApi({
  specUrl: 'openapi.json',
  outputDir: './src/api',
});

# 2. Генерация тестов
await generateApiTests({
  apiFilePath: './src/api/users.api.ts',
  outputDir: './tests/api/users/',
});

# 3. Добавляем реальные тестовые данные
# Редактируем файлы, добавляем /* @protected:start:ID */ блоки

# 4. Помечаем готовые тесты
# Добавляем // @readonly в начало файла
```

### При обновлении OpenAPI

```bash
# 1. Обновляем OpenAPI spec
# curl https://api.example.com/openapi.json > openapi.json

# 2. Перегенерируем API (папка очистится автоматически)
await generateApi({
  specUrl: 'openapi.json',
  outputDir: './src/api',
});

# 3. Обновляем тесты (protected области сохранятся!)
await generateApiTests({
  apiFilePath: './src/api/users.api.ts',
  outputDir: './tests/api/users/',
});

# 4. Проверяем обновления
git diff tests/api/

# 5. Запускаем тесты
npx playwright test
```

## 📥 Скачать

**[api-generator-v5.0.tar.gz](computer:///mnt/user-data/outputs/api-generator-v5.0.tar.gz)** - Версия с умной перезаписью!

## ✅ Checklist новых функций

- [x] Методы API возвращают `response` вместо `response.data`
- [x] Автоочистка папки при `generateApi()`
- [x] Умная перезапись тестов при `generateApiTests()`
- [x] Protected области с `/* @protected:start:ID */`
- [x] ReadOnly тег с `// @readonly`
- [x] Поддержка множества protected областей
- [x] Статистика: создано/обновлено/пропущено
- [x] Альтернативные варианты тегов (@read-only, @READONLY)

Готово к production! 🎊
