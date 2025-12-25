/**
 * Утилиты для поиска и работы с DTO из сгенерированных файлов (Пункт 10)
 */
export interface DTOField {
    name: string;
    type: string;
    required: boolean;
}
export interface DTOInfo {
    name: string;
    fields: DTOField[];
    filePath: string;
}
/**
 * Ищет DTO для endpoint в сгенерированных файлах
 */
export declare function findDtoForEndpoint(apiGeneratedPath: string, endpoint: string, method: string): DTOInfo | null;
/**
 * Генерирует код проверки обязательных полей из DTO
 */
export declare function generateDtoValidationCode(dtoInfo: DTOInfo): string[];
//# sourceMappingURL=dto-finder.d.ts.map