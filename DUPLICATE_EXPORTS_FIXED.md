# ✅ РЕШЕНО: Ошибка дублирования экспортов

## Проблема

При компиляции `npm run build:api` возникала ошибка:

```
dist/orders/index.ts:13:1 - error TS2308: Module './base.types' 
has already exported a member named 'PageMetaData'. 
Consider explicitly re-exporting to resolve the ambiguity.
```

## Причина

Когда несколько API файлов используют одни и те же базовые типы:

```typescript
// orders.api.ts
import { PageMetaData } from './base.types';  // ← обычный import
export function getOrders(): Promise<OrdersList> { ... }

// products.api.ts
import { PageMetaData } from './base.types';  // ← обычный import
export function getProducts(): Promise<ProductsList> { ... }

// index.ts
export * from './base.types';     // ← экспортирует PageMetaData
export * from './orders.api';     // ← СНОВА экспортирует PageMetaData!
export * from './products.api';   // ← И ЕЩЁ РАЗ экспортирует PageMetaData!
```

TypeScript видит что `PageMetaData` экспортируется 3 раза и ругается.

## ✅ Решение: import type

Используем `import type` для типов которые только для TypeScript:

```typescript
// orders.api.ts
import type { PageMetaData } from './base.types';  // ← import type!
export function getOrders(): Promise<OrdersList> { ... }

// products.api.ts
import type { PageMetaData } from './base.types';  // ← import type!
export function getProducts(): Promise<ProductsList> { ... }

// index.ts
export * from './base.types';     // ← экспортирует PageMetaData
export * from './orders.api';     // ← НЕ реэкспортирует (import type)
export * from './products.api';   // ← НЕ реэкспортирует (import type)
```

Теперь `PageMetaData` экспортируется только один раз из `base.types`!

## 🔧 Что было изменено в генераторе

### БЫЛО:
```typescript
if (usedBaseTypes.size > 0) {
  imports.push(`import { ${Array.from(usedBaseTypes).join(', ')} } from './base.types';`);
}
```

### СТАЛО:
```typescript
if (usedBaseTypes.size > 0) {
  imports.push(`import type { ${Array.from(usedBaseTypes).join(', ')} } from './base.types';`);
}
```

Одна строчка - и проблема решена! ✨

## 📊 Результат

### Структура после генерации:

```typescript
// dist/orders/base.types.ts
export interface PageMetaData { ... }
export interface CommonResponse { ... }

// dist/orders/orders.api.ts
import type { PageMetaData } from './base.types';  // ← import type
import type { AxiosResponse } from 'axios';

export interface OrderDto { ... }
export async function getOrders(): Promise<AxiosResponse<OrderDto[]>> { ... }

// dist/orders/products.api.ts
import type { PageMetaData } from './base.types';  // ← import type
import type { AxiosResponse } from 'axios';

export interface ProductDto { ... }
export async function getProducts(): Promise<AxiosResponse<ProductDto[]>> { ... }

// dist/orders/index.ts
export * from './base.types';      // ← Единственный экспорт PageMetaData
export * from './orders.api';      // ← Только OrderDto, getOrders
export * from './products.api';    // ← Только ProductDto, getProducts
```

### Компиляция:

```bash
$ npm run build:api

> @your-company/api-codegen@1.0.0 build:api
> tsc --project tsconfig.api.json

✅ Без ошибок!
```

## 💡 Почему import type решает проблему

### Обычный import:
```typescript
import { PageMetaData } from './base.types';
// Импортирует И типы И значения (если есть)
// При export * - реэкспортируется всё
```

### import type:
```typescript
import type { PageMetaData } from './base.types';
// Импортирует ТОЛЬКО типы
// Не создаёт runtime код
// НЕ реэкспортируется через export *
```

## 🎯 Использование в тестах

Всё работает как раньше:

```typescript
// Импорты из barrel export
import { 
  getOrders, 
  getProducts, 
  PageMetaData,  // ← из base.types
  OrderDto,      // ← из orders.api
  ProductDto     // ← из products.api
} from '@your-company/api-codegen/orders';

// Типизация работает!
const response = await getOrders();
const meta: PageMetaData = response.data.meta;
```

## 🔍 Проверка после генерации

```bash
# Генерируем
npm run generate -- --config=orders.config.json

# Компилируем (должно быть без ошибок)
npm run build:api

# Проверяем что создались .d.ts файлы
ls -la dist/orders/*.d.ts

# Должно быть:
# base.types.d.ts
# orders.api.d.ts
# products.api.d.ts
# index.d.ts
```

## ⚠️ Когда НЕ использовать import type

### ✅ Используйте import type для:
- Интерфейсов
- Типов (type aliases)
- Enum которые используются только как типы

### ❌ НЕ используйте import type для:
- Классов (они runtime значения)
- Функций
- Констант
- Enum которые используются как значения

## Примеры

### ✅ Правильно:
```typescript
import type { OrderDto, PageMetaData } from './types';
import type { AxiosResponse } from 'axios';
import { httpClient } from './http-client';  // ← обычный import (функция)

export async function getOrders(): Promise<AxiosResponse<OrderDto[]>> {
  return httpClient.get('/orders');
}
```

### ❌ Неправильно:
```typescript
import type { httpClient } from './http-client';  // ← ОШИБКА!
// httpClient - это объект (runtime значение), не тип

export async function getOrders() {
  return httpClient.get('/orders');  // ← Не скомпилируется!
}
```

## ✅ Готово!

Теперь:
- ✅ Нет ошибок дублирования экспортов
- ✅ TypeScript компилируется чисто
- ✅ Все типы доступны через barrel export
- ✅ IDE автоимпорт работает
- ✅ Типизация корректная

**Генерируйте API без ошибок!** 🎉
