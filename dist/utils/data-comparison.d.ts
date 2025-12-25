/**
 * Утилиты для сравнения данных из БД с API response
 * Пункт 5: Нормализация данных из БД
 * Пункт 6: Глубокое сравнение с учетом порядка в массивах
 */
/**
 * Нормализует данные из БД (убирает экранирования, парсит JSON)
 */
export declare function normalizeDbData(data: any): any;
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
//# sourceMappingURL=data-comparison.d.ts.map