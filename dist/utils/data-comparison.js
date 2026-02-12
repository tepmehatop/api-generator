"use strict";
/**
 * Утилиты для сравнения данных из БД с API response
 * ВЕРСИЯ 14.1
 *
 * ИСПРАВЛЕНИЯ:
 * - normalizeDbDataByDto для нормализации на основе типов из DTO
 * - НОВОЕ: Корректное сравнение массивов с игнорированием порядка элементов
 * - НОВОЕ: Рекурсивная сортировка вложенных массивов
 * - НОВОЕ: Сортировка по ключевым полям (id, code, uuid)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortArraysRecursively = sortArraysRecursively;
exports.normalizeDbData = normalizeDbData;
exports.normalizeDbDataByDto = normalizeDbDataByDto;
exports.convertDataTypes = convertDataTypes;
exports.deepCompareObjects = deepCompareObjects;
exports.compareDbWithResponse = compareDbWithResponse;
exports.formatDifferencesAsTable = formatDifferencesAsTable;
exports.formatDifferencesAsGitDiff = formatDifferencesAsGitDiff;
exports.formatDifferencesAsBlocks = formatDifferencesAsBlocks;
exports.formatDifferencesAsJsonSideBySide = formatDifferencesAsJsonSideBySide;
/**
 * Ключевые поля для определения уникальности объекта при сортировке
 * Порядок важен - первое найденное поле используется как ключ сортировки
 *
 * Расширенный список для покрытия большинства API:
 * - id, uuid, guid - идентификаторы
 * - code, key - коды/ключи
 * - type, kind, category - типы/категории (для различения order/product/store)
 * - name, title, label - названия
 */
const SORT_KEY_FIELDS = ['id', 'uuid', 'guid', 'code', 'key', 'type', 'kind', 'category', 'name', 'title', 'label'];
/**
 * Универсальная функция сравнения для сортировки
 *
 * Обрабатывает ВСЕ типы данных:
 * - Числа: сортировка по числовому значению (1 < 3 < 5 < 44)
 * - Строки: сортировка по алфавиту ("CREATED" < "DELIVERED" < "ORDERED")
 * - Объекты с ключевыми полями: по значению ключевого поля
 * - Объекты без ключевых полей: по хешу всех значений
 * - null/undefined: в конец
 *
 * @param a - Первый элемент
 * @param b - Второй элемент
 * @returns -1, 0, или 1 для сортировки
 */
function universalCompare(a, b) {
    // null/undefined - в конец
    if (a === null || a === undefined)
        return 1;
    if (b === null || b === undefined)
        return -1;
    const typeA = typeof a;
    const typeB = typeof b;
    // Оба числа - числовая сортировка
    if (typeA === 'number' && typeB === 'number') {
        return a - b;
    }
    // Оба строки - алфавитная сортировка
    if (typeA === 'string' && typeB === 'string') {
        return a.localeCompare(b);
    }
    // Оба boolean
    if (typeA === 'boolean' && typeB === 'boolean') {
        return (a === b) ? 0 : (a ? 1 : -1);
    }
    // Разные примитивные типы - конвертируем в строки
    if (typeA !== 'object' && typeB !== 'object') {
        return String(a).localeCompare(String(b));
    }
    // Оба объекты - используем ключевые поля или хеш
    if (typeA === 'object' && typeB === 'object') {
        const keyA = getObjectSortKey(a);
        const keyB = getObjectSortKey(b);
        // Если ключи - числа, сортируем как числа
        const numA = Number(keyA);
        const numB = Number(keyB);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return keyA.localeCompare(keyB);
    }
    // Объект vs примитив - примитив первым
    if (typeA === 'object')
        return 1;
    return -1;
}
/**
 * Создаёт ключ сортировки для объекта
 *
 * Стратегия:
 * 1. Ищем ключевое поле (id, uuid, code, key, name, title)
 * 2. Если нашли - возвращаем его значение
 * 3. Если не нашли - создаём хеш из всех полей объекта
 *
 * @param obj - Объект для создания ключа
 * @returns Строка-ключ для сортировки
 */
function getObjectSortKey(obj) {
    if (obj === null || obj === undefined) {
        return 'zzz_null'; // В конец при сортировке
    }
    if (typeof obj !== 'object') {
        return String(obj);
    }
    // Массив - хеш из элементов
    if (Array.isArray(obj)) {
        return obj.map(item => getObjectSortKey(item)).sort().join('|');
    }
    // Ищем ключевое поле
    for (const keyField of SORT_KEY_FIELDS) {
        if (keyField in obj && obj[keyField] !== null && obj[keyField] !== undefined) {
            return String(obj[keyField]);
        }
    }
    // Если ключевого поля нет - создаём хеш из всех полей
    // Сортируем ключи для стабильности
    const sortedKeys = Object.keys(obj).sort();
    const values = sortedKeys.map(k => {
        const v = obj[k];
        if (typeof v === 'object' && v !== null) {
            return JSON.stringify(v);
        }
        return String(v);
    });
    return values.join('|');
}
/**
 * Рекурсивно сортирует все массивы в объекте
 *
 * Обрабатывает:
 * - Массивы примитивов: [3, 5, 1, 44] → [1, 3, 5, 44]
 * - Массивы строк: ["ORDERED", "CREATED"] → ["CREATED", "ORDERED"]
 * - Массивы объектов: сортировка по id/uuid/code/key/name/title
 * - Вложенные массивы: рекурсивная обработка
 *
 * @param data - Данные для сортировки
 * @returns Копия данных с отсортированными массивами
 *
 * @example
 * // Массив чисел
 * sortArraysRecursively({ tags: [3, 5, 1, 44] })
 * // → { tags: [1, 3, 5, 44] }
 *
 * @example
 * // Массив строк
 * sortArraysRecursively({ states: ["ORDERED", "CREATED", "TESTED"] })
 * // → { states: ["CREATED", "ORDERED", "TESTED"] }
 *
 * @example
 * // Массив объектов
 * sortArraysRecursively({ items: [{ id: 3 }, { id: 1 }] })
 * // → { items: [{ id: 1 }, { id: 3 }] }
 */
function sortArraysRecursively(data) {
    if (data === null || data === undefined) {
        return data;
    }
    // Примитивные типы - возвращаем как есть
    if (typeof data !== 'object') {
        return data;
    }
    // Массив - сортируем и рекурсивно обрабатываем элементы
    if (Array.isArray(data)) {
        // Сначала рекурсивно обрабатываем каждый элемент
        const processedItems = data.map(item => sortArraysRecursively(item));
        // Сортируем массив универсальной функцией
        return [...processedItems].sort(universalCompare);
    }
    // Объект - рекурсивно обрабатываем каждое поле
    const sorted = {};
    for (const key of Object.keys(data)) {
        sorted[key] = sortArraysRecursively(data[key]);
    }
    return sorted;
}
/**
 * Нормализует данные из БД (убирает экранирования, парсит JSON)
 */
function normalizeDbData(data) {
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
        }
        catch (e) {
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
        const normalized = {};
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
function normalizeDbDataByDto(data, dtoInfo) {
    // Сначала базовая нормализация
    const normalized = normalizeDbData(data);
    if (!normalized || typeof normalized !== 'object') {
        return normalized;
    }
    // Создаём карту типов из DTO
    const typeMap = {};
    for (const field of dtoInfo.fields) {
        typeMap[field.name] = field.type.toLowerCase().trim();
    }
    // Рекурсивная функция для конвертации типов
    function convertTypes(obj, depth = 0) {
        if (depth > 10)
            return obj; // Защита от бесконечной рекурсии
        if (obj === null || obj === undefined) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => convertTypes(item, depth + 1));
        }
        if (typeof obj !== 'object') {
            return obj;
        }
        const converted = {};
        for (const key in obj) {
            const value = obj[key];
            const expectedType = typeMap[key];
            if (expectedType) {
                // Конвертируем согласно ожидаемому типу
                if (expectedType.includes('string')) {
                    converted[key] = String(value);
                }
                else if (expectedType.includes('number')) {
                    const num = Number(value);
                    converted[key] = isNaN(num) ? value : num;
                }
                else if (expectedType.includes('boolean')) {
                    if (typeof value === 'string') {
                        converted[key] = value === 'true' || value === '1';
                    }
                    else {
                        converted[key] = Boolean(value);
                    }
                }
                else if (expectedType.includes('[]') || expectedType.includes('array')) {
                    converted[key] = Array.isArray(value) ? value.map(item => convertTypes(item, depth + 1)) : value;
                }
                else {
                    converted[key] = convertTypes(value, depth + 1);
                }
            }
            else {
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
function convertDataTypes(data) {
    if (data === null || data === undefined) {
        return data;
    }
    // Массивы
    if (Array.isArray(data)) {
        return data.map(item => convertDataTypes(item));
    }
    // Объекты
    if (typeof data === 'object') {
        const converted = {};
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
        if (data === 'true')
            return true;
        if (data === 'false')
            return false;
        if (data === 'null')
            return null;
    }
    return data;
}
/**
 * Глубокое сравнение объектов с игнорированием порядка в массивах
 *
 * ВЕРСИЯ 14.1: Исправлено сравнение массивов объектов
 * - Массивы сортируются рекурсивно ПЕРЕД сравнением
 * - Сортировка по ключевым полям (id, uuid, code, key, name, title)
 * - Если ключевого поля нет - создаётся хеш из всех полей
 *
 * @param actual - Фактические данные (с API)
 * @param expected - Ожидаемые данные (тестовые данные)
 * @returns Результат сравнения с массивом различий
 */
function deepCompareObjects(actual, expected) {
    const differences = [];
    // НОВОЕ v14.1: Сортируем ОБА объекта рекурсивно перед сравнением
    const sortedActual = sortArraysRecursively(actual);
    const sortedExpected = sortArraysRecursively(expected);
    function compare(act, exp, path = 'root') {
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
        // Массивы - уже отсортированы, сравниваем последовательно
        if (Array.isArray(exp)) {
            if (!Array.isArray(act)) {
                differences.push(`${path}: expected array, got ${typeof act}`);
                return false;
            }
            if (act.length !== exp.length) {
                differences.push(`${path}: array length mismatch - expected ${exp.length}, got ${act.length}`);
                return false;
            }
            // Массивы уже отсортированы в sortArraysRecursively
            let allMatch = true;
            for (let i = 0; i < exp.length; i++) {
                if (!compare(act[i], exp[i], `${path}[${i}]`)) {
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
    const isEqual = compare(sortedActual, sortedExpected);
    return { isEqual, differences };
}
/**
 * Комбинированная функция для сравнения данных из БД с response
 */
function compareDbWithResponse(dbData, responseData) {
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
    green: '\x1b[32m', // Ожидаемое значение
    red: '\x1b[31m', // Фактическое значение
    yellow: '\x1b[33m', // Path/заголовки
    cyan: '\x1b[36m', // Дополнительная информация
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
function formatDifferencesAsTable(differences) {
    if (differences.length === 0)
        return '';
    const rows = [];
    // Парсим differences
    for (const diff of differences) {
        const match = diff.match(/^(.+?):\s*(?:type mismatch - )?expected (.+?), got (.+)$/);
        if (match) {
            rows.push({
                path: match[1].trim(),
                expected: match[2].trim(),
                actual: match[3].trim(),
            });
        }
        else {
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
    const line = (left, mid, right, sep) => left + sep.repeat(pathWidth) + mid + sep.repeat(expectedWidth) + mid + sep.repeat(actualWidth) + right;
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
function formatDifferencesAsGitDiff(differences) {
    if (differences.length === 0)
        return '';
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
        }
        else {
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
function formatDifferencesAsBlocks(differences) {
    if (differences.length === 0)
        return '';
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
        }
        else {
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
function formatDifferencesAsJsonSideBySide(differences, normalizedExpected, normalizedActual) {
    if (differences.length === 0)
        return '';
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
        }
        else {
            output += `  ${colors.cyan}•${colors.reset} ${colors.dim}${diff}${colors.reset}\n`;
        }
    }
    output += '\n';
    return output;
}
//# sourceMappingURL=data-comparison.js.map