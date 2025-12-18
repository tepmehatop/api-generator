# ✅ РЕШЕНО: TypeScript ошибки при компиляции

## Проблема

При запуске `npm run build:api` возникали ошибки:

```
error TS2559: Type 'AxiosResponse<any, any>' has no properties 
in common with type 'OrderResponseDto'.
```

## ✅ Решение: Возвращаем AxiosResponse<T>

Теперь методы возвращают **типизированный** `AxiosResponse<T>`:

```typescript
// ДО (не работало):
async getOrders(): Promise<OrderResponseDto[]> {
  const response = await httpClient.get('/orders');
  return response; // ❌ Ошибка типов!
}

// ПОСЛЕ (работает):
async getOrders(): Promise<AxiosResponse<OrderResponseDto[]>> {
  const response = await httpClient.get('/orders');
  return response; // ✅ Правильно!
}
```

## 🎯 Использование в тестах

### Вариант 1: Проверка статуса + данные

```typescript
import { createOrder } from '@your-company/api-codegen/orders';
import type { CreateOrderRequest } from '@your-company/api-codegen/orders';

test('create order - проверяем статус', async () => {
  const request: CreateOrderRequest = {
    productId: 100,
    quantity: 5
  };
  
  const response = await createOrder(request);
  
  // Проверяем статус
  expect(response.status).toBe(201);
  
  // Проверяем данные (типизированы!)
  expect(response.data.id).toBeDefined();
  expect(response.data.productId).toBe(100);
});
```

### Вариант 2: Деструктуризация

```typescript
test('create order - деструктуризация', async () => {
  const { status, data, headers } = await createOrder(request);
  
  expect(status).toBe(201);
  expect(data.id).toBeDefined();
});
```

### Вариант 3: С обработкой ошибок

```typescript
test('create order - с обработкой ошибок', async () => {
  try {
    const response = await createOrder(request);
    
    // Успешный ответ
    expect(response.status).toBe(201);
    expect(response.data.id).toBeDefined();
    
  } catch (error: any) {
    // Ошибка от API
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
      console.log('Headers:', error.response.headers);
    }
    
    throw error;
  }
});
```

## 💡 Продвинутое использование

### 1. Helper для детальных логов

Создайте helper для автоматического логирования:

```typescript
// helpers/api-logger.ts
import type { AxiosResponse, AxiosError } from 'axios';

export async function loggedRequest<T>(
  requestFn: () => Promise<AxiosResponse<T>>,
  requestName: string
): Promise<AxiosResponse<T>> {
  console.log(`🚀 ${requestName}`);
  
  try {
    const response = await requestFn();
    
    console.log(`✅ ${requestName} - ${response.status}`);
    console.log('Response data:', response.data);
    
    return response;
    
  } catch (error: any) {
    console.log(`❌ ${requestName} - FAILED`);
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
      console.log('Headers:', error.response.headers);
    }
    
    if (error.config) {
      console.log('Request URL:', error.config.url);
      console.log('Request method:', error.config.method);
      console.log('Request data:', error.config.data);
    }
    
    throw error;
  }
}

// Использование:
test('with logging', async () => {
  const response = await loggedRequest(
    () => createOrder(request),
    'createOrder'
  );
  
  expect(response.status).toBe(201);
});
```

### 2. Helper с автоматической проверкой статуса

```typescript
// helpers/api-validator.ts
import type { AxiosResponse } from 'axios';

export async function expectSuccess<T>(
  requestFn: () => Promise<AxiosResponse<T>>,
  expectedStatus: number = 200
): Promise<T> {
  const response = await requestFn();
  
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}\n` +
      `Response: ${JSON.stringify(response.data, null, 2)}`
    );
  }
  
  return response.data;
}

// Использование:
test('with auto validation', async () => {
  const data = await expectSuccess(
    () => createOrder(request),
    201
  );
  
  // Автоматически проверен статус 201
  // data уже типизирован!
  expect(data.id).toBeDefined();
});
```

### 3. Helper с CURL генерацией

```typescript
// helpers/curl-generator.ts
import type { AxiosError, AxiosRequestConfig } from 'axios';

export function generateCurl(config: AxiosRequestConfig): string {
  const method = (config.method || 'GET').toUpperCase();
  const url = `${config.baseURL || ''}${config.url || ''}`;
  
  let curl = `curl -X ${method} '${url}'`;
  
  // Headers
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      curl += ` \\\n  -H '${key}: ${value}'`;
    }
  }
  
  // Data
  if (config.data) {
    const data = typeof config.data === 'string' 
      ? config.data 
      : JSON.stringify(config.data);
    curl += ` \\\n  -d '${data}'`;
  }
  
  return curl;
}

export function logRequestWithCurl(error: AxiosError) {
  console.log('❌ Request failed');
  console.log('\nStatus:', error.response?.status);
  console.log('Response:', JSON.stringify(error.response?.data, null, 2));
  
  if (error.config) {
    console.log('\n📋 CURL to reproduce:');
    console.log(generateCurl(error.config));
  }
}

// Использование:
test('with CURL logging', async () => {
  try {
    const response = await createOrder(request);
    expect(response.status).toBe(201);
    
  } catch (error: any) {
    logRequestWithCurl(error);
    throw error;
  }
});
```

### 4. Комплексный helper (всё в одном)

```typescript
// helpers/api-helper.ts
import type { AxiosResponse, AxiosError } from 'axios';
import { generateCurl } from './curl-generator';

interface ApiCallOptions {
  logRequest?: boolean;
  logResponse?: boolean;
  expectedStatus?: number;
  autoValidate?: boolean;
}

export async function apiCall<T>(
  requestFn: () => Promise<AxiosResponse<T>>,
  name: string,
  options: ApiCallOptions = {}
): Promise<AxiosResponse<T>> {
  const {
    logRequest = true,
    logResponse = true,
    expectedStatus = 200,
    autoValidate = true
  } = options;
  
  if (logRequest) {
    console.log(`🚀 ${name}`);
  }
  
  try {
    const response = await requestFn();
    
    // Автоматическая проверка статуса
    if (autoValidate && response.status !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, got ${response.status}`
      );
    }
    
    if (logResponse) {
      console.log(`✅ ${name} - ${response.status}`);
      console.log('Data:', JSON.stringify(response.data, null, 2));
    }
    
    return response;
    
  } catch (error: any) {
    console.log(`❌ ${name} - FAILED`);
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.config) {
      console.log('\n📋 CURL to reproduce:');
      console.log(generateCurl(error.config));
    }
    
    throw error;
  }
}

// Использование:
test('with full helper', async () => {
  const response = await apiCall(
    () => createOrder(request),
    'createOrder',
    { 
      expectedStatus: 201,
      autoValidate: true 
    }
  );
  
  expect(response.data.id).toBeDefined();
});
```

## 📊 Что доступно в response

```typescript
const response = await createOrder(request);

// Статус код
response.status // 201

// Статус текст
response.statusText // "Created"

// Данные (типизированы!)
response.data // OrderResponseDto

// Headers
response.headers // { 'content-type': 'application/json', ... }

// Request config (для дебага)
response.config // { method: 'POST', url: '/orders', ... }

// Request object
response.request // XMLHttpRequest или IncomingMessage
```

## 🎯 Рекомендации

### ✅ Для простых тестов

```typescript
test('simple test', async () => {
  const { status, data } = await createOrder(request);
  expect(status).toBe(201);
  expect(data.id).toBeDefined();
});
```

### ✅ Для тестов с логированием

```typescript
test('with logging', async () => {
  const response = await apiCall(
    () => createOrder(request),
    'createOrder',
    { expectedStatus: 201 }
  );
  
  expect(response.data.id).toBeDefined();
});
```

### ✅ Для E2E тестов

```typescript
test('full flow', async () => {
  // Создаём продукт
  const product = await apiCall(
    () => createProduct({ name: 'Test', price: 100 }),
    'createProduct',
    { expectedStatus: 201 }
  );
  
  // Создаём заказ
  const order = await apiCall(
    () => createOrder({ productId: product.data.id, quantity: 2 }),
    'createOrder',
    { expectedStatus: 201 }
  );
  
  // Проверяем заказ
  const fetchedOrder = await apiCall(
    () => getOrderById(order.data.id),
    'getOrderById'
  );
  
  expect(fetchedOrder.data.productId).toBe(product.data.id);
});
```

## ✅ Готово!

Теперь:
- ✅ TypeScript ошибки исправлены
- ✅ Полный доступ к response (status, data, headers)
- ✅ Типизация работает корректно
- ✅ Можно создать helpers для автоматизации
- ✅ Легко добавить логирование и CURL генерацию

**Используйте AxiosResponse для максимальной гибкости!** 🎉
