"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiGenerator = exports.generateDtoValidationCode = exports.findDtoForEndpoint = exports.generateTypeValidationCode = exports.isServerError = exports.sendErrorNotification = exports.generateCurlCommand = exports.generateErrorEmailHtml = exports.compareDbWithResponse = exports.deepCompareObjects = exports.convertDataTypes = exports.normalizeDbData = exports.collectApiData = exports.createCollector = exports.sendCollectedData = exports.setupApiCollector = exports.reActualizeHappyPathTests = exports.HappyPathTestGenerator = exports.generateHappyPathTests = exports.analyzeAndGenerateTestData = exports.generatePairwiseTests = exports.generatePositiveTests = exports.generateNegativeTests = exports.generateApiTests = void 0;
exports.generateApi = generateApi;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const parser_1 = require("./parser");
const generator_1 = require("./generator");
// Экспорт функции генерации тестов
var test_generator_1 = require("./test-generator");
Object.defineProperty(exports, "generateApiTests", { enumerable: true, get: function () { return test_generator_1.generateApiTests; } });
// НОВОЕ v14.0: Раздельные методы генерации
Object.defineProperty(exports, "generateNegativeTests", { enumerable: true, get: function () { return test_generator_1.generateNegativeTests; } });
Object.defineProperty(exports, "generatePositiveTests", { enumerable: true, get: function () { return test_generator_1.generatePositiveTests; } });
Object.defineProperty(exports, "generatePairwiseTests", { enumerable: true, get: function () { return test_generator_1.generatePairwiseTests; } });
// Экспорт анализатора базы данных
var database_analyzer_1 = require("./database-analyzer");
Object.defineProperty(exports, "analyzeAndGenerateTestData", { enumerable: true, get: function () { return database_analyzer_1.analyzeAndGenerateTestData; } });
// Экспорт генератора Happy Path тестов
var happy_path_generator_1 = require("./happy-path-generator");
Object.defineProperty(exports, "generateHappyPathTests", { enumerable: true, get: function () { return happy_path_generator_1.generateHappyPathTests; } });
Object.defineProperty(exports, "HappyPathTestGenerator", { enumerable: true, get: function () { return happy_path_generator_1.HappyPathTestGenerator; } });
// v14.1: Реактуализация тестовых данных
Object.defineProperty(exports, "reActualizeHappyPathTests", { enumerable: true, get: function () { return happy_path_generator_1.reActualizeHappyPathTests; } });
// Экспорт коллектора данных для UI тестов
var test_collector_1 = require("./test-collector");
Object.defineProperty(exports, "setupApiCollector", { enumerable: true, get: function () { return test_collector_1.setupApiCollector; } });
Object.defineProperty(exports, "sendCollectedData", { enumerable: true, get: function () { return test_collector_1.sendCollectedData; } });
Object.defineProperty(exports, "createCollector", { enumerable: true, get: function () { return test_collector_1.createCollector; } });
Object.defineProperty(exports, "collectApiData", { enumerable: true, get: function () { return test_collector_1.collectApiData; } });
// Экспорт утилит для Happy Path (пункты 5, 6, 9, 10)
var data_comparison_1 = require("./utils/data-comparison");
Object.defineProperty(exports, "normalizeDbData", { enumerable: true, get: function () { return data_comparison_1.normalizeDbData; } });
Object.defineProperty(exports, "convertDataTypes", { enumerable: true, get: function () { return data_comparison_1.convertDataTypes; } });
Object.defineProperty(exports, "deepCompareObjects", { enumerable: true, get: function () { return data_comparison_1.deepCompareObjects; } });
Object.defineProperty(exports, "compareDbWithResponse", { enumerable: true, get: function () { return data_comparison_1.compareDbWithResponse; } });
// НОВОЕ v14.1: Экспорт утилиты для email уведомлений об ошибках
var error_notification_1 = require("./utils/error-notification");
Object.defineProperty(exports, "generateErrorEmailHtml", { enumerable: true, get: function () { return error_notification_1.generateErrorEmailHtml; } });
Object.defineProperty(exports, "generateCurlCommand", { enumerable: true, get: function () { return error_notification_1.generateCurlCommand; } });
Object.defineProperty(exports, "sendErrorNotification", { enumerable: true, get: function () { return error_notification_1.sendErrorNotification; } });
Object.defineProperty(exports, "isServerError", { enumerable: true, get: function () { return error_notification_1.isServerError; } });
var type_validator_1 = require("./utils/type-validator");
Object.defineProperty(exports, "generateTypeValidationCode", { enumerable: true, get: function () { return type_validator_1.generateTypeValidationCode; } });
var dto_finder_1 = require("./utils/dto-finder");
Object.defineProperty(exports, "findDtoForEndpoint", { enumerable: true, get: function () { return dto_finder_1.findDtoForEndpoint; } });
Object.defineProperty(exports, "generateDtoValidationCode", { enumerable: true, get: function () { return dto_finder_1.generateDtoValidationCode; } });
/**
 * Основной класс для генерации API клиента из OpenAPI спецификации
 */
class ApiGenerator {
    constructor(config) {
        this.config = {
            httpClient: 'axios',
            generateErrorHandlers: true,
            generateTypes: true,
            transliterateRussian: true,
            useClasses: false,
            baseUrl: '',
            ...config
        };
    }
    /**
     * Запускает процесс генерации API клиента
     */
    async generate() {
        try {
            console.log('🚀 Начинаю генерацию API клиента...');
            // 0. Очистка выходной папки
            if (fs.existsSync(this.config.outputDir)) {
                console.log(`🧹 Очищаю папку ${this.config.outputDir}...`);
                fs.rmSync(this.config.outputDir, { recursive: true, force: true });
            }
            // Создаем выходную папку заново
            fs.mkdirSync(this.config.outputDir, { recursive: true });
            // 1. Загрузка OpenAPI спецификации
            const spec = await this.loadSpec();
            console.log('✓ OpenAPI спецификация загружена');
            // 2. Парсинг спецификации
            const parser = new parser_1.OpenAPIParser(spec);
            const parsed = parser.parse();
            console.log('✓ Спецификация распарсена');
            // 3. Генерация кода
            const generator = new generator_1.CodeGenerator(this.config, parsed);
            const files = generator.generate();
            console.log('✓ Код сгенерирован');
            // 4. Сохранение файлов
            await this.saveFiles(files);
            console.log('✓ Файлы сохранены');
            console.log(`\n✨ Генерация завершена! Создано файлов: ${files.length}`);
            console.log(`📁 Путь: ${this.config.outputDir}`);
            // 5. Сравнение с предыдущей версией (если указана)
            if (this.config.prevPackage) {
                console.log('\n🔍 Начинаю сравнение с предыдущей версией...');
                await this.compareWithPrevious();
            }
        }
        catch (error) {
            console.error('❌ Ошибка при генерации:', error);
            throw error;
        }
    }
    /**
     * Сравнивает текущую версию с предыдущей
     */
    async compareWithPrevious() {
        const { ApiComparator } = await Promise.resolve().then(() => __importStar(require('./comparator')));
        const comparator = new ApiComparator();
        try {
            // Извлекаем имя сервиса из outputDir
            const serviceName = path.basename(this.config.outputDir);
            // Скачиваем и распаковываем предыдущую версию
            const oldDistPath = await comparator.downloadAndExtractPackage(this.config.prevPackage);
            // Извлекаем информацию из обеих версий
            console.log('📊 Извлекаю информацию из старой версии...');
            const oldInfo = comparator.extractApiInfo(oldDistPath, serviceName);
            console.log('📊 Извлекаю информацию из новой версии...');
            const newDistPath = path.join(process.cwd(), 'dist');
            const newInfo = comparator.extractApiInfo(newDistPath, serviceName);
            // Сравниваем
            console.log('🔄 Сравниваю версии...');
            const result = comparator.compare(oldInfo, newInfo, serviceName);
            // Генерируем отчёт
            const report = comparator.generateComparisonReport(result);
            // Сохраняем отчёт в outputDir (попадёт в NPM пакет)
            const reportPath = path.join(this.config.outputDir, 'COMPARE_README.md');
            fs.writeFileSync(reportPath, report, 'utf-8');
            console.log(`✅ Отчёт о сравнении сохранён: ${this.config.outputDir}/COMPARE_README.md`);
            // Очищаем временные файлы
            comparator.cleanup();
        }
        catch (error) {
            console.error('❌ Ошибка при сравнении версий:', error);
            comparator.cleanup();
            // Не прерываем генерацию из-за ошибки сравнения
        }
    }
    /**
     * Загружает OpenAPI спецификацию из URL или файла
     */
    async loadSpec() {
        const { specUrl } = this.config;
        // Проверяем, является ли это URL
        if (specUrl.startsWith('http://') || specUrl.startsWith('https://')) {
            const response = await axios_1.default.get(specUrl);
            return response.data;
        }
        // Иначе это локальный файл
        const content = fs.readFileSync(specUrl, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Сохраняет сгенерированные файлы в файловую систему
     */
    async saveFiles(files) {
        const { outputDir } = this.config;
        // Создаем выходную директорию если её нет
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        // Сохраняем каждый файл в outputDir
        for (const file of files) {
            const filePath = path.join(outputDir, file.filename);
            fs.writeFileSync(filePath, file.content, 'utf-8');
            console.log(`  → ${file.filename}`);
        }
    }
}
exports.ApiGenerator = ApiGenerator;
/**
 * Функция-хелпер для быстрой генерации
 */
async function generateApi(config) {
    const generator = new ApiGenerator(config);
    await generator.generate();
}
//# sourceMappingURL=index.js.map