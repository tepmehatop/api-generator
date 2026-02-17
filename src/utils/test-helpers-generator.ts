/**
 * Генератор helper функций для тестов
 * ВЕРСИЯ 14.5.4
 *
 * Генерирует вспомогательные функции которые выносятся в test-data:
 * - prepareUniqueFields - подготовка уникальных значений для POST/PUT/PATCH
 * - buildCurlCommand - генерация CURL команды (однострочная, без двойного экранирования)
 * - compareWithoutUniqueFields - сравнение response без уникальных полей
 * - compareWithFieldOptions - сравнение с учётом skipCompareFields и ignoreFieldValues
 * - verifyUniqueFields - проверка уникальных полей в response
 * - formatDifferencesAsBlocks - форматирование различий (реэкспорт)
 */

export interface TestHelpersConfig {
  uniqueFields: string[];
  uniqueFieldsUpperCase: string[];
  packageName: string;
  // НОВОЕ v14.5.4: Поля для пропуска/игнорирования при сравнении
  skipCompareFields?: string[];
  ignoreFieldValues?: string[];
}

/**
 * Генерирует код файла с helper функциями
 */
export function generateTestHelpersCode(config: TestHelpersConfig): string {
  return `/**
 * Helper функции для тестов
 * Автоматически сгенерировано
 */

import { compareDbWithResponse, formatDifferencesAsBlocks } from '${config.packageName}';

// Реэкспорт для удобства использования в тестах
export { formatDifferencesAsBlocks };

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
export function prepareUniqueFields<T>(
  requestData: T
): { data: T; modifiedFields: Record<string, string> } {
  // ИСПРАВЛЕНИЕ v14.5.7: Если массив - возвращаем как есть (нет именованных полей для модификации)
  if (Array.isArray(requestData)) {
    return { data: requestData, modifiedFields: {} };
  }
  const data = { ...requestData } as Record<string, any>;
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

// НОВОЕ v14.5.4: Поля которые полностью пропускаются при сравнении
const SKIP_COMPARE_FIELDS: string[] = ${JSON.stringify(config.skipCompareFields || ['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'])};

// НОВОЕ v14.5.4: Поля где проверяется только существование, но не значение
const IGNORE_FIELD_VALUES: string[] = ${JSON.stringify(config.ignoreFieldValues || [])};

/**
 * Сравнивает response с expected, исключая уникальные поля и skipCompareFields
 * НОВОЕ v14.5.4: Также учитывает ignoreFieldValues
 *
 * @param expected - ожидаемый ответ
 * @param actual - фактический ответ
 * @param modifiedFields - поля которые были модифицированы (уникальные)
 * @returns результат сравнения с массивом differences
 */
export function compareWithoutUniqueFields(
  expected: any,
  actual: any,
  modifiedFields: Record<string, string>
): { isEqual: boolean; differences: string[] } {
  const uniqueFieldNames = Object.keys(modifiedFields);
  // Объединяем уникальные поля + skipCompareFields
  const allFieldsToSkip = [...uniqueFieldNames, ...SKIP_COMPARE_FIELDS];

  // Функция удаления полей из объекта (рекурсивная для вложенных)
  const removeFields = (obj: any, fields: string[]): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => removeFields(item, fields));
    }
    const copy = { ...obj };
    for (const field of fields) {
      if (field in copy) delete copy[field];
    }
    // Рекурсивно обрабатываем вложенные объекты
    for (const key of Object.keys(copy)) {
      if (copy[key] && typeof copy[key] === 'object') {
        copy[key] = removeFields(copy[key], fields);
      }
    }
    return copy;
  };

  // НОВОЕ v14.5.4: Функция замены значений ignoreFieldValues на placeholder
  const normalizeIgnoredFields = (obj: any, fieldsToIgnore: string[]): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => normalizeIgnoredFields(item, fieldsToIgnore));
    }
    const copy = { ...obj };
    for (const field of fieldsToIgnore) {
      if (field in copy) {
        copy[field] = '__IGNORED__'; // Заменяем на placeholder для сравнения структуры
      }
    }
    // Рекурсивно обрабатываем вложенные объекты
    for (const key of Object.keys(copy)) {
      if (copy[key] && typeof copy[key] === 'object') {
        copy[key] = normalizeIgnoredFields(copy[key], fieldsToIgnore);
      }
    }
    return copy;
  };

  let expectedProcessed = removeFields(expected, allFieldsToSkip);
  let actualProcessed = removeFields(actual, allFieldsToSkip);

  // Нормализуем поля где игнорируем значения
  if (IGNORE_FIELD_VALUES.length > 0) {
    expectedProcessed = normalizeIgnoredFields(expectedProcessed, IGNORE_FIELD_VALUES);
    actualProcessed = normalizeIgnoredFields(actualProcessed, IGNORE_FIELD_VALUES);
  }

  const result = compareDbWithResponse(expectedProcessed, actualProcessed);
  return { isEqual: result.isEqual, differences: result.differences };
}

/**
 * Проверяет что уникальные поля в response совпадают с отправленными
 * ИСПРАВЛЕНИЕ v14.5.4: Проверяем только те поля, которые ЕСТЬ в response
 * Если поле отсутствует в response (например response = {id: 123}) - пропускаем проверку
 *
 * @param responseData - данные из response
 * @param modifiedFields - отправленные уникальные значения
 * @returns true если все ПРИСУТСТВУЮЩИЕ поля совпадают, плюс список пропущенных полей
 */
export function verifyUniqueFields(
  responseData: any,
  modifiedFields: Record<string, string>
): { allMatch: boolean; mismatches: string[]; skippedFields: string[] } {
  const mismatches: string[] = [];
  const skippedFields: string[] = [];

  for (const [fieldName, sentValue] of Object.entries(modifiedFields)) {
    // ИСПРАВЛЕНИЕ v14.5.4: Проверяем только если поле СУЩЕСТВУЕТ в response
    if (responseData && fieldName in responseData) {
      const receivedValue = responseData[fieldName];
      if (receivedValue !== sentValue) {
        mismatches.push(\`\${fieldName}: expected '\${sentValue}', got '\${receivedValue}'\`);
      }
    } else {
      // Поле отсутствует в response - пропускаем (не считаем ошибкой)
      skippedFields.push(fieldName);
    }
  }

  return { allMatch: mismatches.length === 0, mismatches, skippedFields };
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

function prepareUniqueFields<T>(requestData: T): { data: T; modifiedFields: Record<string, string> } {
  // ИСПРАВЛЕНИЕ v14.5.7: Если массив - возвращаем как есть
  if (Array.isArray(requestData)) {
    return { data: requestData, modifiedFields: {} };
  }
  const data = { ...requestData } as Record<string, any>;
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
