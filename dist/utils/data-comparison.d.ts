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
import { DTOInfo } from './dto-finder';
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
export declare function sortArraysRecursively(data: any): any;
/**
 * Нормализует данные из БД (убирает экранирования, парсит JSON)
 */
export declare function normalizeDbData(data: any): any;
/**
 * НОВАЯ ФУНКЦИЯ: Нормализует данные из БД на основе типов из DTO
 *
 * Исправляет проблему "title": 3 vs "title": "3"
 */
export declare function normalizeDbDataByDto(data: any, dtoInfo: DTOInfo): any;
/**
 * Преобразует типы данных (строки в числа, etc)
 */
export declare function convertDataTypes(data: any): any;
/**
 * Глубокое сравнение объектов с игнорированием порядка в массивах
 *
 * ВЕРСИЯ 14.5.9: Улучшенное сравнение массивов объектов
 * - Массивы сортируются рекурсивно ПЕРЕД сравнением
 * - Сортировка по ключевым полям (id, uuid, code, key, name, title)
 * - НОВОЕ: Умное сопоставление элементов массива по похожести
 * - НОВОЕ: Если сортировка не помогла, ищем лучшее соответствие
 *
 * @param actual - Фактические данные (с API)
 * @param expected - Ожидаемые данные (тестовые данные)
 * @param skipValueCheckFields - Поля для которых проверяется только наличие, но не значение
 * @returns Результат сравнения с массивом различий
 */
export declare function deepCompareObjects(actual: any, expected: any, skipValueCheckFields?: string[], structureOnly?: boolean): {
    isEqual: boolean;
    differences: string[];
    warnings: string[];
};
/**
 * Комбинированная функция для сравнения данных из БД с response
 */
export declare function compareDbWithResponse(dbData: any, responseData: any, skipValueCheckFields?: string[], structureOnly?: boolean): {
    isEqual: boolean;
    differences: string[];
    warnings: string[];
    normalizedDb: any;
    normalizedResponse: any;
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
export declare function formatDifferencesAsTable(differences: string[]): string;
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
export declare function formatDifferencesAsGitDiff(differences: string[]): string;
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
export declare function formatDifferencesAsBlocks(differences: string[]): string;
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
export declare function formatDifferencesAsJsonSideBySide(differences: string[], normalizedExpected: any, normalizedActual: any): string;
//# sourceMappingURL=data-comparison.d.ts.map