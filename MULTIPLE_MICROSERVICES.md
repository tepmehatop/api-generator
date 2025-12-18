# 🎯 Множественные микросервисы в одном пакете

## Проблема

У вас несколько микросервисов с разными OpenAPI спецификациями:
- Orders API (заказы)
- Products API (продукты)
- Finance API (финансы)

Нужно чтобы все они были в одном пакете и имели автоимпорты.

## ✅ Решение: Динамические exports

Теперь `package.json` автоматически обновляется после каждой генерации!

## 📋 Workflow для нескольких микросервисов

### 1. Генерация всех микросервисов

Создайте конфиги для каждого микросервиса:

**orders.config.json:**
```json
{
  "specUrl": "https://api.example.com/orders/openapi.json",
  "outputDir": "./dist/orders",
  "httpClient": "axios",
  "baseUrl": "process.env.ORDERS_API_URL"
}
```

**products.config.json:**
```json
{
  "specUrl": "https://api.example.com/products/openapi.json",
  "outputDir": "./dist/products",
  "httpClient": "axios",
  "baseUrl": "process.env.PRODUCTS_API_URL"
}
```

**finance.config.json:**
```json
{
  "specUrl": "https://api.example.com/finance/openapi.json",
  "outputDir": "./dist/finance",
  "httpClient": "axios",
  "baseUrl": "process.env.FINANCE_API_URL"
}
```

### 2. Запуск генерации

```bash
# Собираем генератор
npm run build

# Генерируем все микросервисы
npm run generate -- --config=orders.config.json
npm run generate -- --config=products.config.json
npm run generate -- --config=finance.config.json

# Exports обновится автоматически после каждой генерации!
```

### 3. Структура после генерации

```
api-codegen/
├── dist/
│   ├── index.js              ← Генераторы
│   ├── index.d.ts
│   ├── orders/               ← Orders API
│   │   ├── index.ts          ← Barrel export
│   │   ├── orders.api.ts
│   │   ├── orders.types.ts
│   │   └── http-client.ts
│   │
│   ├── products/             ← Products API
│   │   ├── index.ts
│   │   ├── products.api.ts
│   │   ├── products.types.ts
│   │   └── http-client.ts
│   │
│   └── finance/              ← Finance API
│       ├── index.ts
│       ├── transactions.api.ts
│       ├── transactions.types.ts
│       └── http-client.ts
│
└── package.json
    └── exports:
        "." → dist/index.js
        "./orders" → dist/orders/index.ts
        "./orders/*" → dist/orders/*.ts
        "./products" → dist/products/index.ts
        "./products/*" → dist/products/*.ts
        "./finance" → dist/finance/index.ts
        "./finance/*" → dist/finance/*.ts
```

### 4. package.json после генерации

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./orders": {
      "types": "./dist/orders/index.d.ts",
      "default": "./dist/orders/index.js"
    },
    "./orders/*": {
      "types": "./dist/orders/*.d.ts",
      "default": "./dist/orders/*.js"
    },
    "./products": {
      "types": "./dist/products/index.d.ts",
      "default": "./dist/products/index.js"
    },
    "./products/*": {
      "types": "./dist/products/*.d.ts",
      "default": "./dist/products/*.js"
    },
    "./finance": {
      "types": "./dist/finance/index.d.ts",
      "default": "./dist/finance/index.js"
    },
    "./finance/*": {
      "types": "./dist/finance/*.d.ts",
      "default": "./dist/finance/*.js"
    }
  }
}
```

## 🚀 Jenkins для множественных микросервисов

### Вариант 1: Последовательная генерация

```groovy
stage('Generate All APIs') {
    steps {
        sh 'npm install'
        sh 'npm run build'
        
        // Orders
        sh '''
cat > orders.config.json << EOF
{
  "specUrl": "${ORDERS_API_URL}/openapi.json",
  "outputDir": "./dist/orders"
}
EOF
        '''
        sh 'npm run generate -- --config=orders.config.json'
        
        // Products
        sh '''
cat > products.config.json << EOF
{
  "specUrl": "${PRODUCTS_API_URL}/openapi.json",
  "outputDir": "./dist/products"
}
EOF
        '''
        sh 'npm run generate -- --config=products.config.json'
        
        // Finance
        sh '''
cat > finance.config.json << EOF
{
  "specUrl": "${FINANCE_API_URL}/openapi.json",
  "outputDir": "./dist/finance"
}
EOF
        '''
        sh 'npm run generate -- --config=finance.config.json'
        
        // Exports обновляется автоматически после каждой генерации
        sh 'cat package.json | grep -A 30 "exports"'
    }
}
```

### Вариант 2: Через массив конфигов

**generate-all.js:**
```javascript
const { generateApi } = require('./dist/index');

const configs = [
  {
    name: 'orders',
    specUrl: process.env.ORDERS_API_URL + '/openapi.json',
    outputDir: './dist/orders'
  },
  {
    name: 'products',
    specUrl: process.env.PRODUCTS_API_URL + '/openapi.json',
    outputDir: './dist/products'
  },
  {
    name: 'finance',
    specUrl: process.env.FINANCE_API_URL + '/openapi.json',
    outputDir: './dist/finance'
  }
];

(async () => {
  for (const config of configs) {
    console.log(`\n🚀 Generating ${config.name}...`);
    await generateApi(config);
  }
  
  // Обновляем exports
  require('./scripts/update-exports');
  
  console.log('\n✅ All APIs generated!');
})();
```

**Jenkinsfile:**
```groovy
stage('Generate All APIs') {
    steps {
        sh 'npm install'
        sh 'npm run build'
        sh 'node generate-all.js'
    }
}
```

## 🎯 Использование в автотестах

После установки пакета, все микросервисы доступны с автоимпортом!

### Вариант 1: Через barrel exports

```typescript
// Orders API
import { 
  createOrder, 
  getOrderById, 
  updateOrder 
} from '@your-company/api-codegen/orders';

import type { 
  CreateOrderRequest, 
  OrderResponse 
} from '@your-company/api-codegen/orders';

// Products API
import { 
  createProduct, 
  getProducts 
} from '@your-company/api-codegen/products';

import type { 
  CreateProductRequest, 
  ProductResponse 
} from '@your-company/api-codegen/products';

// Finance API
import { 
  createTransaction, 
  getBalance 
} from '@your-company/api-codegen/finance';

import type { 
  TransactionRequest, 
  BalanceResponse 
} from '@your-company/api-codegen/finance';
```

### Вариант 2: Прямой импорт файлов

```typescript
// Прямой доступ к конкретным файлам
import { createOrder } from '@your-company/api-codegen/orders/orders.api';
import type { CreateOrderRequest } from '@your-company/api-codegen/orders/orders.types';
```

### Использование в тестах

```typescript
import test, { expect } from '@playwright/test';

// Импортируем из разных микросервисов
import { createOrder } from '@your-company/api-codegen/orders';
import { createProduct } from '@your-company/api-codegen/products';
import { createTransaction } from '@your-company/api-codegen/finance';

import type { 
  CreateOrderRequest 
} from '@your-company/api-codegen/orders';

test.describe('E2E: Order + Product + Payment', () => {
  test('full flow', async () => {
    // 1. Создаем продукт
    const product = await createProduct({
      name: 'Test Product',
      price: 100
    });
    
    // 2. Создаем заказ
    const order = await createOrder({
      productId: product.data.id,
      quantity: 2
    });
    
    // 3. Создаем транзакцию
    const transaction = await createTransaction({
      orderId: order.data.id,
      amount: 200
    });
    
    expect(transaction.status).toBe(201);
  });
});
```

## 🔧 Как работает автообновление

### npm script: postgenerate

После каждого `npm run generate` автоматически запускается:

```bash
npm run generate → npm run update-exports
```

### scripts/update-exports.js

Скрипт:
1. Сканирует `dist/` и находит все папки
2. Исключает служебные файлы (index.js, generator.js, etc.)
3. Для каждой API папки добавляет в `package.json`:
   ```json
   {
     "./folder-name": "./dist/folder-name/index.ts",
     "./folder-name/*": "./dist/folder-name/*.ts"
   }
   ```
4. Сохраняет обновленный `package.json`

### Логи при генерации

```bash
$ npm run generate -- --config=orders.config.json

📋 Используем конфиг: orders.config.json
🚀 Начинаю генерацию API клиента...
✓ OpenAPI спецификация загружена
✓ Спецификация распарсена
✓ Код сгенерирован
✓ Файлы сохранены

✨ Генерация завершена! Создано файлов: 5
📁 Путь: ./dist/orders

🔍 Сканирую dist/ для обновления exports...
✓ Найдено API папок: 1
  - orders
  ✓ Добавлен export: ./orders

✅ package.json обновлен!

Exports:
  "."
  "./orders"
  "./orders/*"
```

## 💡 Советы

### 1. Именование папок

Используйте короткие, понятные имена:
- ✅ `./dist/orders`
- ✅ `./dist/products`
- ✅ `./dist/finance`
- ❌ `./dist/orders-microservice-v2-api`

### 2. Организация конфигов

Создайте папку `configs/`:
```
configs/
├── orders.json
├── products.json
└── finance.json
```

Затем:
```bash
npm run generate -- --config=configs/orders.json
```

### 3. Проверка exports

После генерации:
```bash
cat package.json | grep -A 50 "exports"
```

### 4. Переменные окружения для URLs

В Jenkins используйте env variables:
```groovy
environment {
    ORDERS_API_URL = 'https://orders.example.com'
    PRODUCTS_API_URL = 'https://products.example.com'
    FINANCE_API_URL = 'https://finance.example.com'
}
```

## ⚠️ Важно!

### Очистка перед новой генерацией

Если нужно полностью перегенерировать:
```bash
npm run clean        # Удаляет dist/
npm run build        # Собирает генератор
npm run generate ... # Генерирует API
```

### Публикация

```bash
# После генерации всех микросервисов
npm version patch
npm publish
```

Exports автоматически обновится перед публикацией через `prepublishOnly`.

## ✅ Готово!

Теперь:
- ✅ Любое количество микросервисов в одном пакете
- ✅ Автоматическое обновление exports
- ✅ Автоимпорты работают для всех папок
- ✅ IDE видит все методы и типы
- ✅ Чистая организация кода

🎉 **Генерируйте сколько угодно микросервисов!**
