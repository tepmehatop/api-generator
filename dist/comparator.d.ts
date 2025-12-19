/**
 * Модуль для сравнения двух версий API
 * Анализирует изменения в методах, endpoints и DTO
 */
export interface ComparisonResult {
    serviceName: string;
    newEndpoints: EndpointInfo[];
    newMethods: MethodInfo[];
    newDtos: DtoInfo[];
    removedEndpoints: EndpointInfo[];
    removedMethods: MethodInfo[];
    removedDtos: DtoInfo[];
    modifiedDtos: DtoChange[];
}
export interface EndpointInfo {
    path: string;
    method: string;
    operationId: string;
}
export interface MethodInfo {
    name: string;
    endpoint: string;
    httpMethod: string;
}
export interface DtoInfo {
    name: string;
    fields: FieldInfo[];
}
export interface FieldInfo {
    name: string;
    type: string;
    required: boolean;
}
export interface DtoChange {
    dtoName: string;
    addedFields: FieldInfo[];
    removedFields: FieldInfo[];
    modifiedFields: FieldModification[];
}
export interface FieldModification {
    fieldName: string;
    oldType: string;
    newType: string;
    wasRequired: boolean;
    nowRequired: boolean;
}
export declare class ApiComparator {
    private tempDir;
    constructor();
    /**
     * Скачивает и распаковывает предыдущую версию пакета
     */
    downloadAndExtractPackage(packageUrl: string): Promise<string>;
    /**
     * Извлекает информацию о методах из папки API
     */
    extractApiInfo(distPath: string, serviceName: string): ApiInfo;
    /**
     * Парсит поля из тела интерфейса
     */
    private parseFields;
    /**
     * Сравнивает две версии API
     */
    compare(oldInfo: ApiInfo, newInfo: ApiInfo, serviceName: string): ComparisonResult;
    /**
     * Сравнивает два DTO
     */
    private compareDtos;
    /**
     * Генерирует markdown отчёт о сравнении
     */
    generateComparisonReport(result: ComparisonResult): string;
    /**
     * Очищает временные файлы
     */
    cleanup(): void;
}
export interface ApiInfo {
    endpoints: EndpointInfo[];
    methods: MethodInfo[];
    dtos: DtoInfo[];
}
//# sourceMappingURL=comparator.d.ts.map