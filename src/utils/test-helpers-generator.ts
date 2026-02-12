/**
 * Генератор helper функций для тестов
 * ВЕРСИЯ 14.5
 *
 * Генерирует вспомогательные функции которые выносятся в test-data:
 * - prepareUniqueFields - подготовка уникальных значений для POST/PUT/PATCH
 * - buildCurlCommand - генерация CURL команды (однострочная, без двойного экранирования)
 * - compareWithoutUniqueFields - сравнение response без уникальных полей
 */

export interface TestHelpersConfig {
  uniqueFields: string[];
  uniqueFieldsUpperCase: string[];
  packageName: string;
}

/**
 * Генерирует код файла с helper функциями
 */
export function generateTestHelpersCode(config: TestHelpersConfig): string {
  return `/**
 * Helper функции для тестов
 * Автоматически сгенерировано
 */

import { compareDbWithResponse } from '${config.packageName}';

/**
 * Генерирует уникальный суффикс для избежания 400 "Уже существует"
 */
export function generateUniqueSuffix(): string {
  return \`_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
}

/**
 * Подготавливает request data с уникальными полями
 * Возвращает модифицированные данные и список изменённых полей
 *
 * @param requestData - исходные данные запроса
 * @returns { data, modifiedFields } - модифицированные данные и map изменённых полей
 */
export function prepareUniqueFields<T extends Record<string, any>>(
  requestData: T
): { data: T; modifiedFields: Record<string, string> } {
  const data = { ...requestData };
  const modifiedFields: Record<string, string> = {};
  const uniqueSuffix = generateUniqueSuffix();

  const uniqueFields = ${JSON.stringify(config.uniqueFields)};
  const upperCaseFields = ${JSON.stringify(config.uniqueFieldsUpperCase)};

  for (const field of uniqueFields) {
    if (data[field] !== undefined && typeof data[field] === 'string') {
      if (upperCaseFields.includes(field)) {
        data[field] = (data[field] + uniqueSuffix).toUpperCase();
      } else {
        data[field] = data[field] + uniqueSuffix;
      }
      modifiedFields[field] = data[field];
    }
  }

  return { data: data as T, modifiedFields };
}

/**
 * Генерирует CURL команду для копирования
 * ВАЖНО: Однострочная команда без лишних переносов, корректное экранирование body
 *
 * @param method - HTTP метод
 * @param url - полный URL
 * @param body - тело запроса (объект или undefined)
 * @param authHeader - заголовок авторизации
 * @returns однострочная CURL команда
 */
export function buildCurlCommand(
  method: string,
  url: string,
  body?: any,
  authHeader?: string
): string {
  const auth = authHeader || 'Bearer YOUR_TOKEN';

  let curl = \`curl -X \${method} '\${url}' -H 'Authorization: \${auth}'\`;

  if (['POST', 'PUT', 'PATCH'].includes(method) && body !== undefined) {
    // Корректное преобразование body в JSON
    // Если body уже строка - используем как есть, иначе stringify
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    curl += \` -H 'Content-Type: application/json' -d '\${bodyStr}'\`;
  }

  return curl;
}

/**
 * Сравнивает response с expected, исключая уникальные поля из обоих объектов
 *
 * @param expected - ожидаемый ответ
 * @param actual - фактический ответ
 * @param modifiedFields - поля которые были модифицированы (уникальные)
 * @returns результат сравнения
 */
export function compareWithoutUniqueFields(
  expected: any,
  actual: any,
  modifiedFields: Record<string, string>
): { isEqual: boolean; formattedDiff?: string } {
  const uniqueFieldNames = Object.keys(modifiedFields);

  // Функция удаления полей из объекта
  const removeFields = (obj: any, fields: string[]): any => {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const field of fields) {
      if (field in copy) delete copy[field];
    }
    return copy;
  };

  const expectedWithoutUnique = removeFields(expected, uniqueFieldNames);
  const actualWithoutUnique = removeFields(actual, uniqueFieldNames);

  return compareDbWithResponse(expectedWithoutUnique, actualWithoutUnique);
}

/**
 * Проверяет что уникальные поля в response совпадают с отправленными
 *
 * @param responseData - данные из response
 * @param modifiedFields - отправленные уникальные значения
 * @returns true если все совпадают
 */
export function verifyUniqueFields(
  responseData: any,
  modifiedFields: Record<string, string>
): { allMatch: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  for (const [fieldName, sentValue] of Object.entries(modifiedFields)) {
    const receivedValue = responseData?.[fieldName];
    if (receivedValue !== sentValue) {
      mismatches.push(\`\${fieldName}: expected '\${sentValue}', got '\${receivedValue}'\`);
    }
  }

  return { allMatch: mismatches.length === 0, mismatches };
}
`;
}

/**
 * Генерирует код с inline helper функциями для тестов
 * Используется когда createSeparateDataFiles = false
 */
export function generateInlineHelpers(config: TestHelpersConfig): string {
  return `
// === HELPER FUNCTIONS ===

function generateUniqueSuffix(): string {
  return \`_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
}

function prepareUniqueFields<T extends Record<string, any>>(requestData: T): { data: T; modifiedFields: Record<string, string> } {
  const data = { ...requestData };
  const modifiedFields: Record<string, string> = {};
  const uniqueSuffix = generateUniqueSuffix();
  const uniqueFields = ${JSON.stringify(config.uniqueFields)};
  const upperCaseFields = ${JSON.stringify(config.uniqueFieldsUpperCase)};

  for (const field of uniqueFields) {
    if (data[field] !== undefined && typeof data[field] === 'string') {
      if (upperCaseFields.includes(field)) {
        data[field] = (data[field] + uniqueSuffix).toUpperCase();
      } else {
        data[field] = data[field] + uniqueSuffix;
      }
      modifiedFields[field] = data[field];
    }
  }
  return { data: data as T, modifiedFields };
}

function buildCurlCommand(method: string, url: string, body?: any, authHeader?: string): string {
  const auth = authHeader || 'Bearer YOUR_TOKEN';
  let curl = \`curl -X \${method} '\${url}' -H 'Authorization: \${auth}'\`;
  if (['POST', 'PUT', 'PATCH'].includes(method) && body !== undefined) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    curl += \` -H 'Content-Type: application/json' -d '\${bodyStr}'\`;
  }
  return curl;
}

// === END HELPER FUNCTIONS ===
`;
}
