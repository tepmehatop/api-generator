/**
 * Утилита для отправки email уведомлений об ошибках
 * ВЕРСИЯ 14.1
 *
 * Централизованное хранение HTML шаблона и логики отправки уведомлений
 * Тесты только собирают данные об ошибке и вызывают этот метод
 */
/**
 * Информация об ошибке для уведомления
 */
export interface ErrorNotificationData {
    /** Код ошибки HTTP (500, 501, 502, 503) */
    errorCode: number;
    /** Текст ошибки */
    errorMessage?: string;
    /** Endpoint API */
    endpoint: string;
    /** HTTP метод */
    method: string;
    /** Полный URL запроса */
    fullUrl: string;
    /** Путь к файлу теста */
    testFilePath?: string;
    /** Название теста */
    testTitle?: string;
    /** Тело запроса (если есть) */
    requestBody?: any;
    /** Данные ответа с ошибкой */
    responseData?: any;
    /** Axios конфиг для генерации CURL */
    axiosConfig?: any;
}
/**
 * Генерирует CURL команду для повторения запроса
 */
export declare function generateCurlCommand(data: ErrorNotificationData): string;
/**
 * Генерирует HTML email из данных об ошибке
 */
export declare function generateErrorEmailHtml(data: ErrorNotificationData): string;
/**
 * Отправляет email уведомление об ошибке
 *
 * @param data - Данные об ошибке
 * @param sendEmailFn - Функция отправки email (принимает HTML строку)
 */
export declare function sendErrorNotification(data: ErrorNotificationData, sendEmailFn: (html: string) => Promise<void>): Promise<void>;
/**
 * Проверяет является ли код ошибки серверной ошибкой (5xx)
 */
export declare function isServerError(statusCode: number): boolean;
//# sourceMappingURL=error-notification.d.ts.map