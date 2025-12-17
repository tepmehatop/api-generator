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
exports.ApiGenerator = exports.analyzeAndGenerateTestData = exports.generateApiTests = void 0;
exports.generateApi = generateApi;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const parser_1 = require("./parser");
const generator_1 = require("./generator");
// Экспорт функции генерации тестов
var test_generator_1 = require("./test-generator");
Object.defineProperty(exports, "generateApiTests", { enumerable: true, get: function () { return test_generator_1.generateApiTests; } });
// Экспорт анализатора базы данных
var database_analyzer_1 = require("./database-analyzer");
Object.defineProperty(exports, "analyzeAndGenerateTestData", { enumerable: true, get: function () { return database_analyzer_1.analyzeAndGenerateTestData; } });
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
        }
        catch (error) {
            console.error('❌ Ошибка при генерации:', error);
            throw error;
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
        // Сохраняем каждый файл
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