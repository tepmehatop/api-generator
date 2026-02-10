"use strict";
/**
 * Утилита для отправки email уведомлений об ошибках
 * ВЕРСИЯ 14.1
 *
 * Централизованное хранение HTML шаблона и логики отправки уведомлений
 * Тесты только собирают данные об ошибке и вызывают этот метод
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCurlCommand = generateCurlCommand;
exports.generateErrorEmailHtml = generateErrorEmailHtml;
exports.sendErrorNotification = sendErrorNotification;
exports.isServerError = isServerError;
/**
 * Генерирует CURL команду для повторения запроса
 */
function generateCurlCommand(data) {
    const authHeader = data.axiosConfig?.headers?.Authorization ||
        data.axiosConfig?.headers?.authorization ||
        'Bearer YOUR_TOKEN';
    let curl = `curl -X ${data.method} '${data.fullUrl}'`;
    curl += ` \\\n  -H 'Authorization: ${authHeader}'`;
    if (['POST', 'PUT', 'PATCH'].includes(data.method) && data.requestBody) {
        curl += ` \\\n  -H 'Content-Type: application/json'`;
        curl += ` \\\n  -d '${JSON.stringify(data.requestBody)}'`;
    }
    return curl;
}
/**
 * Генерирует HTML email из данных об ошибке
 */
function generateErrorEmailHtml(data) {
    const moscowTime = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const curlCommand = generateCurlCommand(data);
    const npxCommand = data.testFilePath ? `npx playwright test "${data.testFilePath}"` : '';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 20px; max-width: 800px; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #dc3545; color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
    .header h1 { margin: 0; font-size: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #333; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .info-row { display: flex; margin-bottom: 5px; }
    .info-label { font-weight: bold; width: 150px; color: #666; }
    .info-value { color: #333; word-break: break-all; }
    .error-code { font-size: 48px; font-weight: bold; color: #dc3545; text-align: center; margin: 20px 0; }
    .code-block { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
    .run-command { background: #28a745; color: white; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>API Test Failed - Server Error ${data.errorCode}</h1>
    </div>

    <div class="error-code">${data.errorCode}</div>

    <div class="section">
      <div class="section-title">Test Information</div>
      ${data.testTitle ? `<div class="info-row"><span class="info-label">Test:</span><span class="info-value">${data.testTitle}</span></div>` : ''}
      ${data.testFilePath ? `<div class="info-row"><span class="info-label">File:</span><span class="info-value">${data.testFilePath}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Time (MSK):</span><span class="info-value">${moscowTime}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Request Information</div>
      <div class="info-row"><span class="info-label">Endpoint:</span><span class="info-value">${data.endpoint}</span></div>
      <div class="info-row"><span class="info-label">Method:</span><span class="info-value">${data.method}</span></div>
      <div class="info-row"><span class="info-label">Full URL:</span><span class="info-value">${data.fullUrl}</span></div>
      <div class="info-row"><span class="info-label">Error Code:</span><span class="info-value">${data.errorCode}</span></div>
      ${data.errorMessage ? `<div class="info-row"><span class="info-label">Error:</span><span class="info-value">${data.errorMessage}</span></div>` : ''}
    </div>

    ${npxCommand ? `
    <div class="section">
      <div class="section-title">Run Test Command</div>
      <div class="run-command">${npxCommand}</div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">CURL Command</div>
      <div class="code-block">${curlCommand}</div>
    </div>

    ${data.requestBody ? `
    <div class="section">
      <div class="section-title">Request Body</div>
      <div class="code-block">${JSON.stringify(data.requestBody, null, 2)}</div>
    </div>
    ` : ''}

    ${data.responseData ? `
    <div class="section">
      <div class="section-title">Response Data</div>
      <div class="code-block">${JSON.stringify(data.responseData, null, 2)}</div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}
/**
 * Отправляет email уведомление об ошибке
 *
 * @param data - Данные об ошибке
 * @param sendEmailFn - Функция отправки email (принимает HTML строку)
 */
async function sendErrorNotification(data, sendEmailFn) {
    const html = generateErrorEmailHtml(data);
    await sendEmailFn(html);
}
/**
 * Проверяет является ли код ошибки серверной ошибкой (5xx)
 */
function isServerError(statusCode) {
    return statusCode >= 500 && statusCode <= 599;
}
//# sourceMappingURL=error-notification.js.map