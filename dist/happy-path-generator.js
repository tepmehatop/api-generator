"use strict";
/**
 * Генератор Happy Path API тестов на основе реальных данных с фронта
 *
 * Особенности:
 * - Читает данные из БД (qa.api_requests)
 * - Инкрементальная генерация (дополняет существующие файлы)
 * - Отслеживание сгенерированных тестов в БД
 * - Force режим для перегенерации
 * - Стандартная структура как в позитивных/негативных тестах
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HappyPathTestGenerator = void 0;
exports.generateHappyPathTests = generateHappyPathTests;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class HappyPathTestGenerator {
    constructor(config, dbConnectionMethod) {
        this.config = {
            ...config,
            dbSchema: config.dbSchema || 'qa',
            force: config.force || false,
            endpointFilter: config.endpointFilter || [],
            methodFilter: config.methodFilter || [],
            maxTestsPerEndpoint: config.maxTestsPerEndpoint || 10,
            onlySuccessful: config.onlySuccessful !== false,
            testTag: config.testTag || '@apiHappyPath',
            axiosHelpersPath: config.axiosHelpersPath || '../../../helpers/axiosHelpers'
        };
        this.dbMethod = dbConnectionMethod;
    }
    /**
     * Генерирует все Happy Path тесты
     */
    async generate() {
        console.log('🔍 Подключаюсь к БД и собираю данные...');
        console.log(this.config.force ? '⚠️  FORCE режим - перегенерация всех тестов' : 'ℹ️  Инкрементальный режим - только новые данные');
        const uniqueRequests = await this.fetchUniqueRequests();
        console.log(`📊 Найдено ${uniqueRequests.length} уникальных запросов`);
        const grouped = this.groupByEndpoint(uniqueRequests);
        console.log(`📁 Сгруппировано по ${Object.keys(grouped).length} endpoints`);
        let totalTests = 0;
        let newTests = 0;
        for (const [endpoint, requests] of Object.entries(grouped)) {
            const { total, added } = await this.generateTestsForEndpoint(endpoint, requests);
            totalTests += total;
            newTests += added;
        }
        console.log(`\n✨ Генерация завершена!`);
        console.log(`   Всего тестов: ${totalTests}`);
        console.log(`   Новых тестов: ${newTests}`);
    }
    async fetchUniqueRequests() {
        const conditions = [];
        if (this.config.onlySuccessful) {
            conditions.push('response_status >= 200 AND response_status < 300');
        }
        if (this.config.endpointFilter.length > 0) {
            const endpoints = this.config.endpointFilter.map(e => `'${e}'`).join(',');
            conditions.push(`endpoint IN (${endpoints})`);
        }
        if (this.config.methodFilter.length > 0) {
            const methods = this.config.methodFilter.map(m => `'${m}'`).join(',');
            conditions.push(`method IN (${methods})`);
        }
        if (!this.config.force) {
            conditions.push('test_generated = FALSE');
        }
        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const query = `
      SELECT DISTINCT ON (endpoint, method, request_body::text)
        id, endpoint, method, request_body, response_body,
        response_status, test_name, test_generated, test_file_path
      FROM ${this.config.dbSchema}.api_requests
      ${where}
      ORDER BY endpoint, method, request_body::text, created_at DESC
    `;
        const requests = await this.dbMethod([query]);
        return requests;
    }
    groupByEndpoint(requests) {
        const grouped = {};
        for (const request of requests) {
            const key = `${request.method}:${request.endpoint}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            if (grouped[key].length < this.config.maxTestsPerEndpoint) {
                grouped[key].push(request);
            }
        }
        return grouped;
    }
    async generateTestsForEndpoint(endpointKey, requests) {
        const [method, endpoint] = endpointKey.split(':');
        const fileName = this.endpointToFileName(endpoint, method);
        const filePath = path.join(this.config.outputDir, `${fileName}.happy-path.spec.ts`);
        const fileExists = fs.existsSync(filePath);
        let existingTests = [];
        let newTestsAdded = 0;
        if (fileExists && !this.config.force) {
            const content = fs.readFileSync(filePath, 'utf-8');
            existingTests = this.extractTestIds(content);
            requests = requests.filter(r => !existingTests.includes(`db-id-${r.id}`));
            newTestsAdded = requests.length;
            if (requests.length === 0) {
                console.log(`  ⏭️  ${fileName}.happy-path.spec.ts - нет новых данных`);
                return { total: existingTests.length, added: 0 };
            }
            await this.appendTestsToFile(filePath, endpoint, method, requests, existingTests.length);
            console.log(`  ✓ ${fileName}.happy-path.spec.ts (+${requests.length} ${requests.length === 1 ? 'тест' : 'тестов'})`);
        }
        else {
            const testCode = this.generateTestFile(endpoint, method, requests);
            fs.writeFileSync(filePath, testCode, 'utf-8');
            newTestsAdded = requests.length;
            const mode = this.config.force ? '🔄' : '✨';
            console.log(`  ${mode} ${fileName}.happy-path.spec.ts (${requests.length} ${requests.length === 1 ? 'тест' : 'тестов'})`);
        }
        await this.markAsGenerated(requests.map(r => r.id), filePath);
        return {
            total: existingTests.length + newTestsAdded,
            added: newTestsAdded
        };
    }
    extractTestIds(content) {
        const regex = /\/\/ DB ID: (db-id-\d+)/g;
        const ids = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            ids.push(match[1]);
        }
        return ids;
    }
    async appendTestsToFile(filePath, endpoint, method, requests, existingCount) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lastClosingBrace = content.lastIndexOf('});');
        if (lastClosingBrace === -1) {
            throw new Error(`Не удалось найти закрывающую скобку в ${filePath}`);
        }
        const newTests = this.generateTestCases(endpoint, method, requests, existingCount + 1);
        const before = content.substring(0, lastClosingBrace);
        const after = content.substring(lastClosingBrace);
        const updated = before + '\n' + newTests + '\n' + after;
        fs.writeFileSync(filePath, updated, 'utf-8');
    }
    generateTestFile(endpoint, method, requests) {
        const lines = [];
        lines.push(`/**`);
        lines.push(` * Happy Path тесты для ${method} ${endpoint}`);
        lines.push(` * `);
        lines.push(` * Сгенерировано автоматически из реальных данных с фронта`);
        lines.push(` * Дата: ${new Date().toISOString()}`);
        lines.push(` * `);
        lines.push(` * SQL запрос для поиска данных в БД:`);
        lines.push(` * SELECT * FROM qa.api_requests `);
        lines.push(` * WHERE endpoint = '${endpoint}' AND method = '${method}'`);
        lines.push(` * ORDER BY created_at DESC;`);
        lines.push(` */`);
        lines.push('');
        lines.push(`import { test, expect } from '@playwright/test';`);
        lines.push(`import axios from 'axios';`);
        lines.push(`import { configApiHeaderAdmin } from '${this.config.axiosHelpersPath}';`);
        lines.push('');
        const describeTitle = `${method} ${endpoint} - Happy Path`;
        lines.push(`test.describe('${describeTitle}', () => {`);
        lines.push(`  test.describe.configure({ tag: '${this.config.testTag}' });`);
        lines.push('');
        lines.push(`  const endpoint = '${endpoint}';`);
        lines.push(`  const httpMethod = '${method}';`);
        lines.push(`  const success = ${this.getSuccessCode(method)};`);
        lines.push('');
        lines.push('  // ============================================');
        lines.push('  // HAPPY PATH ТЕСТЫ (Данные с фронта)');
        lines.push('  // ============================================');
        lines.push('');
        const testCases = this.generateTestCases(endpoint, method, requests, 1);
        lines.push(testCases);
        lines.push(`});`);
        lines.push('');
        return lines.join('\n');
    }
    generateTestCases(endpoint, method, requests, startIndex) {
        const lines = [];
        requests.forEach((request, index) => {
            const testNumber = startIndex + index;
            const testTitle = this.generateTestTitle(request, testNumber);
            lines.push(`  test(\`\${httpMethod} ${testTitle} (\${success}) ${this.config.testTag}\`, async ({ page }, testInfo) => {`);
            lines.push(`    // Данные из UI теста: ${request.test_name}`);
            lines.push(`    // DB ID: db-id-${request.id}`);
            lines.push('');
            const hasRequestBody = request.request_body && Object.keys(request.request_body).length > 0;
            if (hasRequestBody) {
                lines.push(`    // Request Body (реальные данные с фронта):`);
                lines.push(`    const requestData = ${JSON.stringify(request.request_body, null, 6).replace(/\n/g, '\n    ')};`);
                lines.push('');
            }
            if (request.response_body) {
                lines.push(`    // Expected Response:`);
                lines.push(`    const expectedResponse = ${JSON.stringify(request.response_body, null, 6).replace(/\n/g, '\n    ')};`);
                lines.push('');
            }
            const axiosCall = this.generateAxiosCall(method, hasRequestBody);
            lines.push(`    // Выполняем запрос`);
            lines.push(`    const response = await ${axiosCall};`);
            lines.push('');
            lines.push(`    // Проверки`);
            lines.push(`    await expect(response.status).toBe(${request.response_status});`);
            lines.push(`    await expect(response.data).toBeDefined();`);
            if (request.response_body) {
                lines.push(`    await expect(response.data).toMatchObject(expectedResponse);`);
            }
            lines.push(`  });`);
            lines.push('');
        });
        return lines.join('\n');
    }
    generateAxiosCall(method, hasRequestBody) {
        const methodLower = method.toLowerCase();
        if (hasRequestBody) {
            return `axios.${methodLower}(process.env.StandURL + endpoint, requestData, configApiHeaderAdmin)`;
        }
        else {
            return `axios.${methodLower}(process.env.StandURL + endpoint, configApiHeaderAdmin)`;
        }
    }
    generateTestTitle(request, testNumber) {
        if (request.request_body && typeof request.request_body === 'object') {
            const keys = Object.keys(request.request_body);
            if (keys.length > 0) {
                const firstKey = keys[0];
                const value = request.request_body[firstKey];
                const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
                return `Happy Path #${testNumber} (${firstKey}: ${displayValue})`;
            }
        }
        return `Happy Path #${testNumber}`;
    }
    getSuccessCode(method) {
        return method === 'POST' ? 201 : 200;
    }
    endpointToFileName(endpoint, method) {
        return endpoint
            .replace(/^\/api\/v\d+\//, '')
            .replace(/\{(\w+)\}/g, '$1')
            .replace(/\//g, '-')
            .replace(/[^a-z0-9-]/gi, '')
            .toLowerCase() + '-' + method.toLowerCase();
    }
    async markAsGenerated(ids, filePath) {
        for (const id of ids) {
            await this.dbMethod([`
        UPDATE ${this.config.dbSchema}.api_requests
        SET 
          test_generated = TRUE,
          test_file_path = '${filePath}',
          generated_at = NOW()
        WHERE id = ${id}
      `]);
        }
    }
}
exports.HappyPathTestGenerator = HappyPathTestGenerator;
async function generateHappyPathTests(config, dbConnectionMethod) {
    const generator = new HappyPathTestGenerator(config, dbConnectionMethod);
    await generator.generate();
}
//# sourceMappingURL=happy-path-generator.js.map