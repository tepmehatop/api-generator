/**
 * Утилиты для сравнения данных из БД с API response
 *
 * ИСПРАВЛЕНИЕ: Добавлена normalizeDbDataByDto для нормализации на основе типов из DTO
 */

import { DTOInfo } from './dto-finder';

/**
 * Нормализует данные из БД (убирает экранирования, парсит JSON)
 */
export function normalizeDbData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Если это строка - пытаемся распарсить как JSON
  if (typeof data === 'string') {
    try {
      // Убираем лишние экранирования и слеши
      let cleaned = data.replace(/\\\\/g, '\\');
      cleaned = cleaned.replace(/\\"/g, '"');

      const parsed = JSON.parse(cleaned);
      return normalizeDbData(parsed); // Рекурсивно
    } catch (e) {
      // Если не JSON - возвращаем как есть
      return data;
    }
  }

  // Если это массив - нормализуем каждый элемент
  if (Array.isArray(data)) {
    return data.map(item => normalizeDbData(item));
  }

  // Если это объект - нормализуем каждое поле
  if (typeof data === 'object') {
    const normalized: any = {};
    for (const key in data) {
      normalized[key] = normalizeDbData(data[key]);
    }
    return normalized;
  }

  return data;
}

/**
 * НОВАЯ ФУНКЦИЯ: Нормализует данные из БД на основе типов из DTO
 *
 * Исправляет проблему "title": 3 vs "title": "3"
 */
export function normalizeDbDataByDto(data: any, dtoInfo: DTOInfo): any {
  // Сначала базовая нормализация
  const normalized = normalizeDbData(data);

  if (!normalized || typeof normalized !== 'object') {
    return normalized;
  }

  // Создаём карту типов из DTO
  const typeMap: Record<string, string> = {};
  for (const field of dtoInfo.fields) {
    typeMap[field.name] = field.type.toLowerCase().trim();
  }

  // Рекурсивная функция для конвертации типов
  function convertTypes(obj: any, depth: number = 0): any {
    if (depth > 10) return obj; // Защита от бесконечной рекурсии

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => convertTypes(item, depth + 1));
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    const converted: any = {};

    for (const key in obj) {
      const value = obj[key];
      const expectedType = typeMap[key];

      if (expectedType) {
        // Конвертируем согласно ожидаемому типу
        if (expectedType.includes('string')) {
          converted[key] = String(value);
        } else if (expectedType.includes('number')) {
          const num = Number(value);
          converted[key] = isNaN(num) ? value : num;
        } else if (expectedType.includes('boolean')) {
          if (typeof value === 'string') {
            converted[key] = value === 'true' || value === '1';
          } else {
            converted[key] = Boolean(value);
          }
        } else if (expectedType.includes('[]') || expectedType.includes('array')) {
          converted[key] = Array.isArray(value) ? value.map(item => convertTypes(item, depth + 1)) : value;
        } else {
          converted[key] = convertTypes(value, depth + 1);
        }
      } else {
        // Поля которых нет в DTO - просто рекурсивно обрабатываем
        converted[key] = convertTypes(value, depth + 1);
      }
    }

    return converted;
  }

  return convertTypes(normalized);
}

/**
 * Преобразует типы данных (строки в числа, etc)
 */
export function convertDataTypes(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Массивы
  if (Array.isArray(data)) {
    return data.map(item => convertDataTypes(item));
  }

  // Объекты
  if (typeof data === 'object') {
    const converted: any = {};
    for (const key in data) {
      converted[key] = convertDataTypes(data[key]);
    }
    return converted;
  }

  // Строки - проверяем числа
  if (typeof data === 'string') {
    // Проверяем целые числа
    if (/^\d+$/.test(data)) {
      return parseInt(data, 10);
    }
    // Проверяем дробные числа
    if (/^\d+\.\d+$/.test(data)) {
      return parseFloat(data);
    }
    // Проверяем булевы значения
    if (data === 'true') return true;
    if (data === 'false') return false;
    if (data === 'null') return null;
  }

  return data;
}

/**
 * Глубокое сравнение объектов с игнорированием порядка в массивах
 */
export function deepCompareObjects(actual: any, expected: any): {
  isEqual: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  function compare(act: any, exp: any, path: string = 'root'): boolean {
    // Проверка на null/undefined
    if (act === null || act === undefined || exp === null || exp === undefined) {
      if (act !== exp) {
        differences.push(`${path}: expected ${exp}, got ${act}`);
        return false;
      }
      return true;
    }

    // Проверка типов
    const actType = typeof act;
    const expType = typeof exp;

    if (actType !== expType) {
      differences.push(`${path}: type mismatch - expected ${expType}, got ${actType}`);
      return false;
    }

    // Примитивные типы
    if (actType !== 'object') {
      if (act !== exp) {
        differences.push(`${path}: expected ${exp}, got ${act}`);
        return false;
      }
      return true;
    }

    // Массивы - СОРТИРУЕМ перед сравнением
    if (Array.isArray(exp)) {
      if (!Array.isArray(act)) {
        differences.push(`${path}: expected array, got ${typeof act}`);
        return false;
      }

      if (act.length !== exp.length) {
        differences.push(`${path}: array length mismatch - expected ${exp.length}, got ${act.length}`);
        return false;
      }

      // Сортируем массивы перед сравнением
      const actSorted = [...act].sort((a, b) => {
        if (typeof a === 'object') return 0;
        return String(a).localeCompare(String(b));
      });

      const expSorted = [...exp].sort((a, b) => {
        if (typeof a === 'object') return 0;
        return String(a).localeCompare(String(b));
      });

      let allMatch = true;
      for (let i = 0; i < expSorted.length; i++) {
        if (!compare(actSorted[i], expSorted[i], `${path}[${i}]`)) {
          allMatch = false;
        }
      }

      return allMatch;
    }

    // Объекты - поле за полем
    const expKeys = Object.keys(exp);
    let allMatch = true;

    for (const key of expKeys) {
      if (!(key in act)) {
        differences.push(`${path}.${key}: missing in actual`);
        allMatch = false;
        continue;
      }

      if (!compare(act[key], exp[key], `${path}.${key}`)) {
        allMatch = false;
      }
    }

    return allMatch;
  }

  const isEqual = compare(actual, expected);

  return { isEqual, differences };
}

/**
 * Комбинированная функция для сравнения данных из БД с response
 */
export function compareDbWithResponse(dbData: any, responseData: any): {
  isEqual: boolean;
  differences: string[];
  normalizedDb: any;
  normalizedResponse: any;
} {
  // Нормализуем оба объекта
  let normalizedDb = normalizeDbData(dbData);
  normalizedDb = convertDataTypes(normalizedDb);

  let normalizedResponse = normalizeDbData(responseData);
  normalizedResponse = convertDataTypes(normalizedResponse);

  // Сравниваем
  const { isEqual, differences } = deepCompareObjects(normalizedResponse, normalizedDb);

  return {
    isEqual,
    differences,
    normalizedDb,
    normalizedResponse
  };
}

/**
 * ANSI color codes для консоли
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',      // Ожидаемое значение
  red: '\x1b[31m',        // Фактическое значение
  yellow: '\x1b[33m',     // Path/заголовки
  cyan: '\x1b[36m',       // Дополнительная информация
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * ВАРИАНТ 1: Табличный формат
 *
 * Пример вывода:
 * ┌──────────────┬────────────────┬────────────────┐
 * │ Path         │ Expected       │ Actual         │
 * ├──────────────┼────────────────┼────────────────┤
 * │ root.id      │ 123            │ 124            │
 * │ root.status  │ active         │ pending        │
 * └──────────────┴────────────────┴────────────────┘
 */
export function formatDifferencesAsTable(differences: string[]): string {
  if (differences.length === 0) return '';

  const rows: { path: string; expected: string; actual: string }[] = [];

  // Парсим differences
  for (const diff of differences) {
    const match = diff.match(/^(.+?):\s*(?:type mismatch - )?expected (.+?), got (.+)$/);
    if (match) {
      rows.push({
        path: match[1].trim(),
        expected: match[2].trim(),
        actual: match[3].trim(),
      });
    } else {
      // Для других форматов (например "missing in actual")
      rows.push({
        path: diff.split(':')[0] || '',
        expected: '-',
        actual: diff.split(':')[1]?.trim() || diff,
      });
    }
  }

  // Вычисляем ширину колонок
  const pathWidth = Math.max(12, ...rows.map(r => r.path.length)) + 2;
  const expectedWidth = Math.max(14, ...rows.map(r => r.expected.length)) + 2;
  const actualWidth = Math.max(14, ...rows.map(r => r.actual.length)) + 2;

  const line = (left: string, mid: string, right: string, sep: string) =>
    left + sep.repeat(pathWidth) + mid + sep.repeat(expectedWidth) + mid + sep.repeat(actualWidth) + right;

  let output = '\n' + colors.bold + colors.yellow + '❌ Данные не совпадают:' + colors.reset + '\n\n';
  output += line('┌', '┬', '┐', '─') + '\n';
  output += `│ ${colors.bold}Path${colors.reset}${' '.repeat(pathWidth - 5)}│ ${colors.green}${colors.bold}Expected${colors.reset}${' '.repeat(expectedWidth - 9)}│ ${colors.red}${colors.bold}Actual${colors.reset}${' '.repeat(actualWidth - 7)}│\n`;
  output += line('├', '┼', '┤', '─') + '\n';

  for (const row of rows) {
    const pathPadded = row.path + ' '.repeat(Math.max(0, pathWidth - row.path.length - 1));
    const expectedPadded = row.expected + ' '.repeat(Math.max(0, expectedWidth - row.expected.length - 1));
    const actualPadded = row.actual + ' '.repeat(Math.max(0, actualWidth - row.actual.length - 1));

    output += `│ ${colors.yellow}${pathPadded}${colors.reset}│ ${colors.green}${expectedPadded}${colors.reset}│ ${colors.red}${actualPadded}${colors.reset}│\n`;
  }

  output += line('└', '┴', '┘', '─') + '\n';

  return output;
}

/**
 * ВАРИАНТ 2: Git-style Diff формат
 *
 * Пример вывода:
 * --- Expected
 * +++ Actual
 *
 * @ root.id
 * - 123
 * + 124
 *
 * @ root.status
 * - active
 * + pending
 */
export function formatDifferencesAsGitDiff(differences: string[]): string {
  if (differences.length === 0) return '';

  let output = '\n' + colors.bold + colors.yellow + '❌ Данные не совпадают:' + colors.reset + '\n\n';
  output += colors.green + '--- Expected' + colors.reset + '\n';
  output += colors.red + '+++ Actual' + colors.reset + '\n\n';

  for (const diff of differences) {
    const match = diff.match(/^(.+?):\s*(?:type mismatch - )?expected (.+?), got (.+)$/);
    if (match) {
      const path = match[1].trim();
      const expected = match[2].trim();
      const actual = match[3].trim();

      output += colors.cyan + `@ ${path}` + colors.reset + '\n';
      output += colors.green + `- ${expected}` + colors.reset + '\n';
      output += colors.red + `+ ${actual}` + colors.reset + '\n\n';
    } else {
      output += colors.dim + diff + colors.reset + '\n\n';
    }
  }

  return output;
}

/**
 * ВАРИАНТ 3: Блочный список с цветными блоками
 *
 * Пример вывода:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🔍 Path: root.id
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   ✅ Expected: 123
 *   ❌ Actual:   124
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🔍 Path: root.status
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   ✅ Expected: active
 *   ❌ Actual:   pending
 */
export function formatDifferencesAsBlocks(differences: string[]): string {
  if (differences.length === 0) return '';

  let output = '\n' + colors.bold + colors.yellow + '❌ Данные не совпадают:' + colors.reset + '\n';

  for (const diff of differences) {
    const match = diff.match(/^(.+?):\s*(?:type mismatch - )?expected (.+?), got (.+)$/);
    if (match) {
      const path = match[1].trim();
      const expected = match[2].trim();
      const actual = match[3].trim();

      output += '\n' + colors.dim + '━'.repeat(50) + colors.reset + '\n';
      output += colors.cyan + `🔍 Path: ${colors.bold}${path}${colors.reset}\n`;
      output += colors.dim + '━'.repeat(50) + colors.reset + '\n';
      output += `  ${colors.green}✅ Expected: ${colors.bold}${expected}${colors.reset}\n`;
      output += `  ${colors.red}❌ Actual:   ${colors.bold}${actual}${colors.reset}\n`;
    } else {
      output += '\n' + colors.dim + '━'.repeat(50) + colors.reset + '\n';
      output += colors.yellow + `⚠️  ${diff}` + colors.reset + '\n';
    }
  }

  output += '\n';
  return output;
}

/**
 * ВАРИАНТ 4: JSON Side-by-side (упрощенный)
 *
 * Пример вывода:
 * ╔══════════════════════════════════════════════════════════╗
 * ║  EXPECTED                    ACTUAL                      ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  {                           {                           ║
 * ║    "id": 123,                  "id": 124,                ║
 * ║    "status": "active"          "status": "pending"       ║
 * ║  }                           }                           ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Differences:
 * • root.id: 123 → 124
 * • root.status: active → pending
 */
export function formatDifferencesAsJsonSideBySide(
  differences: string[],
  normalizedExpected: any,
  normalizedActual: any
): string {
  if (differences.length === 0) return '';

  let output = '\n' + colors.bold + colors.yellow + '❌ Данные не совпадают:' + colors.reset + '\n\n';

  // JSON представление
  const expectedJson = JSON.stringify(normalizedExpected, null, 2);
  const actualJson = JSON.stringify(normalizedActual, null, 2);

  output += colors.green + colors.bold + '✅ EXPECTED:' + colors.reset + '\n';
  output += colors.green + expectedJson + colors.reset + '\n\n';

  output += colors.red + colors.bold + '❌ ACTUAL:' + colors.reset + '\n';
  output += colors.red + actualJson + colors.reset + '\n\n';

  output += colors.yellow + colors.bold + 'DIFFERENCES:' + colors.reset + '\n';

  for (const diff of differences) {
    const match = diff.match(/^(.+?):\s*(?:type mismatch - )?expected (.+?), got (.+)$/);
    if (match) {
      const path = match[1].trim();
      const expected = match[2].trim();
      const actual = match[3].trim();

      output += `  ${colors.cyan}•${colors.reset} ${colors.dim}${path}:${colors.reset} ${colors.green}${expected}${colors.reset} ${colors.yellow}→${colors.reset} ${colors.red}${actual}${colors.reset}\n`;
    } else {
      output += `  ${colors.cyan}•${colors.reset} ${colors.dim}${diff}${colors.reset}\n`;
    }
  }

  output += '\n';
  return output;
}