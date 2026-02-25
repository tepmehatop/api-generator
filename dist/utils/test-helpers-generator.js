"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTestHelpersCode = generateTestHelpersCode;
exports.generateInlineHelpers = generateInlineHelpers;
/**
 * Генерирует код файла с helper функциями
 */
function generateTestHelpersCode(config) {
    return `/**
 * Helper функции для тестов
 * Автоматически сгенерировано
 */

import { compareDbWithResponse, formatDifferencesAsBlocks } from '${config.packageName}';

// Реэкспорт для удобства использования в тестах
export { formatDifferencesAsBlocks };

/**
 * НОВОЕ v14.5.9: Анализирует формат оригинального значения
 */
function analyzeValueFormat(value: string): {
  isUppercase: boolean;
  isLowercase: boolean;
  hasDigits: boolean;
  hasLetters: boolean;
  segments: { type: 'letters' | 'digits' | 'delimiter'; value: string; isUpper: boolean }[];
  length: number;
} {
  const segments: { type: 'letters' | 'digits' | 'delimiter'; value: string; isUpper: boolean }[] = [];
  let currentSegment = '';
  let currentType: 'letters' | 'digits' | 'delimiter' | null = null;

  for (const char of value) {
    const isLetter = /[a-zA-Z]/.test(char);
    const isDigit = /[0-9]/.test(char);
    let charType: 'letters' | 'digits' | 'delimiter';
    if (isLetter) charType = 'letters';
    else if (isDigit) charType = 'digits';
    else charType = 'delimiter';

    if (currentType !== charType) {
      if (currentSegment) {
        segments.push({
          type: currentType!,
          value: currentSegment,
          isUpper: currentType === 'letters' ? currentSegment === currentSegment.toUpperCase() : false
        });
      }
      currentSegment = char;
      currentType = charType;
    } else {
      currentSegment += char;
    }
  }
  if (currentSegment) {
    segments.push({
      type: currentType!,
      value: currentSegment,
      isUpper: currentType === 'letters' ? currentSegment === currentSegment.toUpperCase() : false
    });
  }

  const letters = value.replace(/[^a-zA-Z]/g, '');
  return {
    isUppercase: letters.length > 0 && letters === letters.toUpperCase(),
    isLowercase: letters.length > 0 && letters === letters.toLowerCase(),
    hasDigits: /[0-9]/.test(value),
    hasLetters: letters.length > 0,
    segments,
    length: value.length
  };
}

/**
 * НОВОЕ v14.5.9: Генерирует случайную строку заданного типа
 */
function generateRandomString(length: number, type: 'uppercase' | 'lowercase' | 'mixed' | 'digits'): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjklmnpqrstuvwxyz';
  const digits = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    switch (type) {
      case 'uppercase':
        result += upper[Math.floor(Math.random() * upper.length)];
        break;
      case 'lowercase':
        result += lower[Math.floor(Math.random() * lower.length)];
        break;
      case 'mixed':
        result += Math.random() > 0.5 ? upper[Math.floor(Math.random() * upper.length)] : lower[Math.floor(Math.random() * lower.length)];
        break;
      case 'digits':
        result += digits[Math.floor(Math.random() * digits.length)];
        break;
    }
  }
  return result;
}

/**
 * НОВОЕ v14.5.9: Генерирует ПОЛНОСТЬЮ НОВОЕ уникальное значение
 * НЕ добавляет суффикс, а ПОЛНОСТЬЮ заменяет значение, сохраняя формат
 *
 * AUTOCODE → XKZPQWNM (не AUTOCODE_suffix)
 */
function generateSmartUniqueValue(originalValue: string, forceUpperCase: boolean = false): string {
  if (!originalValue || originalValue.trim() === '') {
    return generateRandomString(8, 'uppercase');
  }

  const format = analyzeValueFormat(originalValue);

  // Если форсируем uppercase
  if (forceUpperCase) {
    // Генерируем посегментно, сохраняя разделители
    if (format.segments.length > 1) {
      return format.segments.map(segment => {
        if (segment.type === 'delimiter') return segment.value;
        if (segment.type === 'digits') return generateRandomString(segment.value.length, 'digits');
        return generateRandomString(segment.value.length, 'uppercase');
      }).join('');
    }
    return generateRandomString(format.length, 'uppercase');
  }

  // Автоопределение типа по оригиналу
  if (format.segments.length > 1) {
    // Есть разделители - генерируем посегментно
    return format.segments.map(segment => {
      if (segment.type === 'delimiter') return segment.value;
      if (segment.type === 'digits') return generateRandomString(segment.value.length, 'digits');
      const segmentType = segment.isUpper ? 'uppercase' : 'lowercase';
      return generateRandomString(segment.value.length, segmentType);
    }).join('');
  }

  // Простое значение без разделителей
  let genType: 'uppercase' | 'lowercase' | 'mixed' | 'digits' = 'uppercase';
  if (!format.hasLetters && format.hasDigits) {
    genType = 'digits';
  } else if (format.isUppercase) {
    genType = 'uppercase';
  } else if (format.isLowercase) {
    genType = 'lowercase';
  } else {
    genType = 'mixed';
  }

  return generateRandomString(format.length, genType);
}

/**
 * Подготавливает request data с уникальными полями
 * ВЕРСИЯ v14.5.9: Полная замена значений (не суффикс!)
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

  const uniqueFields = ${JSON.stringify(config.uniqueFields)};
  const upperCaseFields = ${JSON.stringify(config.uniqueFieldsUpperCase)};

  for (const field of uniqueFields) {
    if (data[field] !== undefined && typeof data[field] === 'string') {
      const forceUpper = upperCaseFields.includes(field);
      // НОВОЕ v14.5.9: Полная замена значения, а не добавление суффикса
      data[field] = generateSmartUniqueValue(data[field], forceUpper);
      modifiedFields[field] = data[field];
    }
  }

  return { data: data as T, modifiedFields };
}

/**
 * НОВОЕ v14.5.8: Обёртка для axios конфига - удаляет Content-Length
 * Content-Length вызывает 502 ошибки на некоторых бекендах
 *
 * @param axiosConfig - оригинальный конфиг axios
 * @returns конфиг с transformRequest который удаляет Content-Length
 */
export function getAxiosConfigWithoutContentLength(axiosConfig: any): any {
  return {
    ...axiosConfig,
    transformRequest: [
      (data: any, headers: any) => {
        if (headers) {
          delete headers['Content-Length'];
          delete headers['content-length'];
        }
        return typeof data === 'string' ? data : JSON.stringify(data);
      }
    ]
  };
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
 * НОВОЕ v14.6: Поддержка skipValueCheckFields - проверка только наличия поля без сравнения значения
 *
 * @param expected - ожидаемый ответ
 * @param actual - фактический ответ
 * @param modifiedFields - поля которые были модифицированы (уникальные)
 * @param skipValueCheckFields - поля для которых проверяется только наличие, не значение
 * @returns результат сравнения с массивом differences
 */
export function compareWithoutUniqueFields(
  expected: any,
  actual: any,
  modifiedFields: Record<string, string>,
  skipValueCheckFields: string[] = [],
  structureOnly: boolean = false
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

  // НОВОЕ v14.5.9: Функция проверки соответствия пути паттерну игнорируемого поля
  // Поддерживает: "count", "meta.count", "root.meta.count"
  const matchesIgnoredPath = (currentPath: string, ignoredField: string): boolean => {
    // Убираем "root." если есть
    const cleanPath = currentPath.replace(/^root\\./, '');
    const cleanIgnored = ignoredField.replace(/^root\\./, '');

    // Точное совпадение
    if (cleanPath === cleanIgnored) return true;

    // Проверяем совпадение окончания пути (для простых имён полей)
    // Например: "meta.count" заканчивается на "count"
    if (!cleanIgnored.includes('.') && cleanPath.endsWith('.' + cleanIgnored)) return true;
    if (!cleanIgnored.includes('.') && cleanPath === cleanIgnored) return true;

    // Проверяем вложенные пути: cleanPath="data.meta.count", cleanIgnored="meta.count"
    if (cleanPath.endsWith(cleanIgnored)) return true;

    return false;
  };

  // НОВОЕ v14.5.9: Функция замены значений ignoreFieldValues на placeholder
  // ИСПРАВЛЕНО: Поддержка вложенных путей типа "meta.count"
  const normalizeIgnoredFields = (obj: any, fieldsToIgnore: string[], currentPath: string = ''): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map((item, index) => normalizeIgnoredFields(item, fieldsToIgnore, currentPath + '[' + index + ']'));
    }
    const copy = { ...obj };
    for (const key of Object.keys(copy)) {
      const fieldPath = currentPath ? currentPath + '.' + key : key;

      // Проверяем, нужно ли игнорировать это поле
      const shouldIgnore = fieldsToIgnore.some(ignored => matchesIgnoredPath(fieldPath, ignored));

      if (shouldIgnore) {
        copy[key] = '__IGNORED__'; // Заменяем на placeholder для сравнения структуры
      } else if (copy[key] && typeof copy[key] === 'object') {
        // Рекурсивно обрабатываем вложенные объекты
        copy[key] = normalizeIgnoredFields(copy[key], fieldsToIgnore, fieldPath);
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

  const result = compareDbWithResponse(expectedProcessed, actualProcessed, skipValueCheckFields, structureOnly);
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
function generateInlineHelpers(config) {
    return `
// === HELPER FUNCTIONS ===

// НОВОЕ v14.5.9: Генерирует случайную строку заданного типа
function generateRandomString(length: number, type: 'uppercase' | 'lowercase' | 'mixed' | 'digits'): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjklmnpqrstuvwxyz';
  const digits = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    switch (type) {
      case 'uppercase': result += upper[Math.floor(Math.random() * upper.length)]; break;
      case 'lowercase': result += lower[Math.floor(Math.random() * lower.length)]; break;
      case 'mixed': result += Math.random() > 0.5 ? upper[Math.floor(Math.random() * upper.length)] : lower[Math.floor(Math.random() * lower.length)]; break;
      case 'digits': result += digits[Math.floor(Math.random() * digits.length)]; break;
    }
  }
  return result;
}

// НОВОЕ v14.5.9: Генерирует ПОЛНОСТЬЮ НОВОЕ уникальное значение (не суффикс!)
function generateSmartUniqueValue(originalValue: string, forceUpperCase: boolean = false): string {
  if (!originalValue || originalValue.trim() === '') return generateRandomString(8, 'uppercase');

  const segments: { type: 'letters' | 'digits' | 'delimiter'; value: string; isUpper: boolean }[] = [];
  let currentSegment = '';
  let currentType: 'letters' | 'digits' | 'delimiter' | null = null;

  for (const char of originalValue) {
    const isLetter = /[a-zA-Z]/.test(char);
    const isDigit = /[0-9]/.test(char);
    let charType: 'letters' | 'digits' | 'delimiter';
    if (isLetter) charType = 'letters';
    else if (isDigit) charType = 'digits';
    else charType = 'delimiter';

    if (currentType !== charType) {
      if (currentSegment) {
        segments.push({ type: currentType!, value: currentSegment, isUpper: currentType === 'letters' ? currentSegment === currentSegment.toUpperCase() : false });
      }
      currentSegment = char;
      currentType = charType;
    } else {
      currentSegment += char;
    }
  }
  if (currentSegment) segments.push({ type: currentType!, value: currentSegment, isUpper: currentType === 'letters' ? currentSegment === currentSegment.toUpperCase() : false });

  // Генерируем посегментно, сохраняя структуру
  return segments.map(segment => {
    if (segment.type === 'delimiter') return segment.value;
    if (segment.type === 'digits') return generateRandomString(segment.value.length, 'digits');
    const segmentType = forceUpperCase || segment.isUpper ? 'uppercase' : 'lowercase';
    return generateRandomString(segment.value.length, segmentType);
  }).join('');
}

// НОВОЕ v14.5.8: Удаляет Content-Length из axios запросов
function getAxiosConfigWithoutContentLength(axiosConfig: any): any {
  return {
    ...axiosConfig,
    transformRequest: [
      (data: any, headers: any) => {
        if (headers) {
          delete headers['Content-Length'];
          delete headers['content-length'];
        }
        return typeof data === 'string' ? data : JSON.stringify(data);
      }
    ]
  };
}

// НОВОЕ v14.5.9: Полная замена уникальных полей (не суффикс!)
function prepareUniqueFields<T>(requestData: T): { data: T; modifiedFields: Record<string, string> } {
  if (Array.isArray(requestData)) return { data: requestData, modifiedFields: {} };
  const data = { ...requestData } as Record<string, any>;
  const modifiedFields: Record<string, string> = {};
  const uniqueFields = ${JSON.stringify(config.uniqueFields)};
  const upperCaseFields = ${JSON.stringify(config.uniqueFieldsUpperCase)};

  for (const field of uniqueFields) {
    if (data[field] !== undefined && typeof data[field] === 'string') {
      const forceUpper = upperCaseFields.includes(field);
      data[field] = generateSmartUniqueValue(data[field], forceUpper);
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
//# sourceMappingURL=test-helpers-generator.js.map