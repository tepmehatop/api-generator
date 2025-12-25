/**
 * Утилиты для валидации структуры и типов данных в response (Пункт 9)
 */
export interface FieldSchema {
    name: string;
    type: string;
    required: boolean;
    isArray?: boolean;
}
/**
 * Генерирует код валидации типов для response
 */
export declare function generateTypeValidationCode(data: any, varName?: string): string[];
//# sourceMappingURL=type-validator.d.ts.map