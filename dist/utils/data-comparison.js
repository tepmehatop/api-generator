"use strict";
/**
 * Утилиты для сравнения данных из БД с API response
 * Пункт 5: Нормализация данных из БД
 * Пункт 6: Глубокое сравнение с учетом порядка в массивах
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDbData = normalizeDbData;
exports.convertDataTypes = convertDataTypes;
exports.deepCompareObjects = deepCompareObjects;
exports.compareDbWithResponse = compareDbWithResponse;
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
            // Убираем лишние экранирования
            const cleaned = data.replace(/\\\\/g, '\\');
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
        if (/^\d+$/.test(data)) {
            return parseInt(data, 10);
        }
        if (/^\d+\.\d+$/.test(data)) {
            return parseFloat(data);
        }
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
 */
function deepCompareObjects(actual, expected) {
    const differences = [];
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
            // Сортируем массивы
            const actSorted = [...act].sort((a, b) => {
                if (typeof a === 'object')
                    return 0;
                return String(a).localeCompare(String(b));
            });
            const expSorted = [...exp].sort((a, b) => {
                if (typeof a === 'object')
                    return 0;
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
//# sourceMappingURL=data-comparison.js.map