import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIParser } from './parser';
import { CodeGenerator } from './generator';
import { transliterate } from './utils/transliterate';

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
   */
  baseUrl?: string;
  
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
  private config: Required<GeneratorConfig>;
  
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
    } catch (error) {
      console.error('❌ Ошибка при генерации:', error);
      throw error;
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
    
    // Сохраняем каждый файл
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
