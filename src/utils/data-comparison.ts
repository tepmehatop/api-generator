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