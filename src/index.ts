import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIParser } from './parser';
import { CodeGenerator } from './generator';
import { transliterate } from './utils/transliterate';

// Экспорт функции генерации тестов
export {
  generateApiTests,
  ApiTestConfig,
  // НОВОЕ v14.0: Раздельные методы генерации
  generateNegativeTests,
  generatePositiveTests,
  generatePairwiseTests,
  NegativeTestConfig,
  PositiveTestConfig,
  PairwiseTestConfig,
  BaseTestConfig
} from './test-generator';

// Экспорт анализатора базы данных
export { analyzeAndGenerateTestData, DatabaseAnalyzerConfig } from './database-analyzer';

// Экспорт генератора Happy Path тестов
export {
  generateHappyPathTests,
  HappyPathTestConfig,
  HappyPathTestGenerator,
  // v14.1: Реактуализация тестовых данных
  reActualizeHappyPathTests,
  ReActualizeConfig,
  ReActualizeResult
} from './happy-path-generator';

// Экспорт коллектора данных для UI тестов
export { 
  setupApiCollector, 
  sendCollectedData, 
  createCollector, 
  collectApiData,
  CollectorConfig, 
  ApiRequestData 
} from './test-collector';

// Экспорт утилит для Happy Path (пункты 5, 6, 9, 10)
export {
  normalizeDbData,
  convertDataTypes,
  deepCompareObjects,
  compareDbWithResponse
} from './utils/data-comparison';

// НОВОЕ v14.1: Экспорт утилиты для email уведомлений об ошибках
export {
  generateErrorEmailHtml,
  generateCurlCommand,
  sendErrorNotification,
  isServerError,
  ErrorNotificationData
} from './utils/error-notification';

export { 
  generateTypeValidationCode, 
  FieldSchema 
} from './utils/type-validator';

export { 
  findDtoForEndpoint, 
  generateDtoValidationCode, 
  DTOInfo, 
  DTOField 
} from './utils/dto-finder';

export interface GeneratorConfig {
  /**
   * URL или путь к OpenAPI документу (JSON)
   */
  specUrl: string;
  
  /**
   * Путь к папке для выгрузки сгенерированных файлов
   */
  outputDir: string;
  
  /**
   * HTTP клиент для API запросов
   * @default 'axios'
   */
  httpClient?: 'axios' | 'fetch';
  
  /**
   * Базовый URL для API запросов (опционально)
   * Можно передать как строку или имя переменной окружения
   * @example 'https://api.example.com'
   * @example 'process.env.STAND_URL'
   */
  baseUrl?: string;
  
  /**
   * URL к предыдущей версии пакета для сравнения (опционально)
   * Формат: https://registry.com/repo/npm/package/package-1.55.tgz
   * Если указан, будет создан CompareReadme.md с изменениями
   * @example 'https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-1.55.tgz'
   */
  prevPackage?: string;
  
  /**
   * Переменная окружения для токена авторизации
   * @example 'process.env.AUTH_TOKEN'
   */
  authTokenVar?: string;
  
  /**
   * Добавить хелперы для обработки ошибок
   * @default true
   */
  generateErrorHandlers?: boolean;
  
  /**
   * Генерировать типы для запросов/ответов
   * @default true
   */
  generateTypes?: boolean;
  
  /**
   * Использовать transliteration для русских названий тегов
   * @default true
   */
  transliterateRussian?: boolean;
  
  /**
   * Генерировать методы как класс вместо отдельных функций
   * @default false
   */
  useClasses?: boolean;
}

/**
 * Основной класс для генерации API клиента из OpenAPI спецификации
 */
export class ApiGenerator {
  private config: GeneratorConfig & {
    httpClient: 'axios' | 'fetch';
    generateErrorHandlers: boolean;
    generateTypes: boolean;
    transliterateRussian: boolean;
    useClasses: boolean;
    baseUrl: string;
  };
  
  constructor(config: GeneratorConfig) {
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
  async generate(): Promise<void> {
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
      const parser = new OpenAPIParser(spec);
      const parsed = parser.parse();
      console.log('✓ Спецификация распарсена');
      
      // 3. Генерация кода
      const generator = new CodeGenerator(this.config, parsed);
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
    } catch (error) {
      console.error('❌ Ошибка при генерации:', error);
      throw error;
    }
  }
  
  /**
   * Сравнивает текущую версию с предыдущей
   */
  private async compareWithPrevious(): Promise<void> {
    const { ApiComparator } = await import('./comparator');
    const comparator = new ApiComparator();
    
    try {
      // Извлекаем имя сервиса из outputDir
      const serviceName = path.basename(this.config.outputDir);
      
      // Скачиваем и распаковываем предыдущую версию
      const oldDistPath = await comparator.downloadAndExtractPackage(this.config.prevPackage!);
      
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
    } catch (error) {
      console.error('❌ Ошибка при сравнении версий:', error);
      comparator.cleanup();
      // Не прерываем генерацию из-за ошибки сравнения
    }
  }
  
  /**
   * Загружает OpenAPI спецификацию из URL или файла
   */
  private async loadSpec(): Promise<any> {
    const { specUrl } = this.config;
    
    // Проверяем, является ли это URL
    if (specUrl.startsWith('http://') || specUrl.startsWith('https://')) {
      const response = await axios.get(specUrl);
      return response.data;
    }
    
    // Иначе это локальный файл
    const content = fs.readFileSync(specUrl, 'utf-8');
    return JSON.parse(content);
  }
  
  /**
   * Сохраняет сгенерированные файлы в файловую систему
   */
  private async saveFiles(files: Array<{ filename: string; content: string }>): Promise<void> {
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

/**
 * Функция-хелпер для быстрой генерации
 */
export async function generateApi(config: GeneratorConfig): Promise<void> {
  const generator = new ApiGenerator(config);
  await generator.generate();
}
