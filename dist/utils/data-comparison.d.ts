/**
 * Утилиты для сравнения данных из БД с API response
 *
 * ИСПРАВЛЕНИЕ: Добавлена normalizeDbDataByDto для нормализации на основе типов из DTO
 */
import { DTOInfo } from './dto-finder';
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
 */
export declare function deepCompareObjects(actual: any, expected: any): {
    isEqual: boolean;
    differences: string[];
};
/**
 * Комбинированная функция для сравнения данных из БД с response
 */
export declare function compareDbWithResponse(dbData: any, responseData: any): {
    isEqual: boolean;
    differences: string[];
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