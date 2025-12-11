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
exports.DatabaseAnalyzer = void 0;
exports.analyzeAndGenerateTestData = analyzeAndGenerateTestData;
const fs = __importStar(require("fs"));
const axios_1 = __importDefault(require("axios"));
/**
 * Анализатор базы данных для генерации тестовых данных
 */
class DatabaseAnalyzer {
    constructor(config, dbConnectFunction) {
        this.schemaCache = new Map();
        this.config = {
            force: false,
            dataStrategy: 'existing',
            samplesCount: 5,
            ...config
        };
        this.dbConnect = dbConnectFunction;
    }
    /**
     * Главный метод - анализирует тест и генерирует данные
     */
    async analyze() {
        console.log('🔍 Начинаю анализ теста и БД...');
        console.log(`📄 Тест файл: ${this.config.testFilePath}`);
        // 1. Читаем тест файл и извлекаем информацию
        const testInfo = await this.extractTestInfo();
        console.log(`✓ Извлечена информация о тесте`);
        console.log(`  Endpoint: ${testInfo.httpMethod} ${testInfo.endpoint}`);
        console.log(`  DTO: ${testInfo.dtoName || 'не указано'}`);
        // 2. Проверяем нужно ли заново искать таблицы
        if (!this.config.force && testInfo.existingTables.length > 0) {
            console.log(`✓ Используются существующие таблицы: ${testInfo.existingTables.join(', ')}`);
            // Генерируем только данные
            const testData = await this.generateTestData(testInfo.existingTables);
            return {
                endpoint: testInfo.endpoint,
                confirmedTables: testInfo.existingTables,
                suspectedTables: [],
                relatedTables: [],
                testData
            };
        }
        // 3. Загружаем DTO если указан
        let dtoFields = [];
        if (testInfo.dtoPath && testInfo.dtoName) {
            dtoFields = await this.extractDTOFields(testInfo.dtoPath, testInfo.dtoName);
            console.log(`✓ Извлечены поля DTO: ${dtoFields.join(', ')}`);
        }
        // 4. ЭТАП 1: Schema Analysis - находим подозрительные таблицы
        console.log('\n📊 ЭТАП 1: Анализ схемы БД...');
        const suspectedTables = await this.findTablesByFields(dtoFields);
        console.log(`✓ Найдено подозрительных таблиц: ${suspectedTables.length}`);
        suspectedTables.forEach(t => console.log(`  - ${t.name} (confidence: ${(t.confidence * 100).toFixed(0)}%)`));
        // 5. ЭТАП 2: FK Analysis - расширяем список связанными таблицами
        console.log('\n🔗 ЭТАП 2: Анализ Foreign Keys...');
        const relatedTables = await this.findRelatedTables(suspectedTables.map(t => t.name));
        console.log(`✓ Найдено связанных таблиц: ${relatedTables.length}`);
        relatedTables.forEach(t => console.log(`  - ${t}`));
        // 6. ЭТАП 3: Empirical Test - подтверждаем реальным вызовом
        console.log('\n🎯 ЭТАП 3: Эмпирический тест...');
        const allTablesToCheck = [
            ...suspectedTables.map(t => t.name),
            ...relatedTables
        ];
        const confirmedTables = await this.confirmWithRealCall(testInfo.endpoint, testInfo.httpMethod, dtoFields, allTablesToCheck);
        console.log(`✓ Подтверждено таблиц: ${confirmedTables.length}`);
        confirmedTables.forEach(t => console.log(`  - ${t}`));
        // 7. Генерируем тестовые данные
        console.log('\n💾 Генерация тестовых данных...');
        const testData = await this.generateTestData(confirmedTables);
        console.log(`✓ Сгенерированы данные для ${Object.keys(testData).length} таблиц`);
        // 8. Обновляем тест файл
        await this.updateTestFile(confirmedTables, testData);
        console.log(`✓ Тест файл обновлен`);
        return {
            endpoint: testInfo.endpoint,
            confirmedTables,
            suspectedTables: suspectedTables.map(t => t.name),
            relatedTables,
            testData
        };
    }
    /**
     * Извлекает информацию из тест файла
     */
    async extractTestInfo() {
        console.log('  🔍 Читаю тест файл...');
        try {
            const content = fs.readFileSync(this.config.testFilePath, 'utf-8');
            console.log(`  ✓ Файл прочитан, размер: ${content.length} символов`);
            // Извлекаем endpoint
            const endpointMatch = content.match(/const endpoint = ['`](.+?)['`];/);
            const endpoint = endpointMatch ? endpointMatch[1] : '';
            console.log(`  ✓ Endpoint: ${endpoint || 'НЕ НАЙДЕН'}`);
            // Извлекаем HTTP метод
            const methodMatch = content.match(/const httpMethod = ['"](.+?)['"];/);
            const httpMethod = methodMatch ? methodMatch[1] : 'GET';
            console.log(`  ✓ HTTP Method: ${httpMethod}`);
            // Извлекаем DTO информацию
            const dtoNameMatch = content.match(/const dtoName = ['"](.+?)['"];/);
            const dtoName = dtoNameMatch ? dtoNameMatch[1] : undefined;
            console.log(`  ✓ DTO Name: ${dtoName || 'НЕ НАЙДЕНО'}`);
            const dtoPathMatch = content.match(/const dtoPath = ['"](.+?)['"];/);
            const dtoPath = dtoPathMatch ? dtoPathMatch[1] : undefined;
            console.log(`  ✓ DTO Path: ${dtoPath || 'НЕ НАЙДЕНО'}`);
            // Извлекаем существующие таблицы
            const tablesMatch = content.match(/\/\/ @db-tables:start\s*\n.*?const dbTables.*?=.*?\[(.*?)\];/s);
            let existingTables = [];
            if (tablesMatch && tablesMatch[1].trim()) {
                existingTables = tablesMatch[1]
                    .split(',')
                    .map(t => t.trim().replace(/['"]/g, ''))
                    .filter(t => t.length > 0);
                console.log(`  ✓ Существующие таблицы: ${existingTables.join(', ')}`);
            }
            else {
                console.log(`  ℹ️  Таблицы еще не определены`);
            }
            return {
                endpoint,
                httpMethod,
                dtoName,
                dtoPath,
                existingTables
            };
        }
        catch (error) {
            console.error(`  ❌ Ошибка при чтении теста: ${error.message}`);
            throw error;
        }
    }
    /**
     * Извлекает поля из DTO
     */
    async extractDTOFields(dtoPath, dtoName) {
        console.log(`  🔍 Читаю DTO из ${dtoPath}...`);
        try {
            // Проверяем существование файла
            if (!fs.existsSync(dtoPath)) {
                console.error(`  ❌ Файл не найден: ${dtoPath}`);
                return [];
            }
            const content = fs.readFileSync(dtoPath, 'utf-8');
            console.log(`  ✓ Файл прочитан, размер: ${content.length} символов`);
            // Ищем интерфейс или type
            const interfaceRegex = new RegExp(`export\\s+(?:interface|type)\\s+${dtoName}\\s*[={]([^}]+)}`, 's');
            const match = content.match(interfaceRegex);
            if (!match) {
                console.error(`  ❌ DTO '${dtoName}' не найдено в файле`);
                console.log(`  💡 Ищу варианты в файле...`);
                // Показываем какие интерфейсы есть
                const allInterfaces = content.match(/export\s+(?:interface|type)\s+(\w+)/g);
                if (allInterfaces) {
                    console.log(`  📋 Найденные типы в файле:`);
                    allInterfaces.slice(0, 10).forEach(i => console.log(`      - ${i}`));
                }
                return [];
            }
            const interfaceBody = match[1];
            const fields = [];
            console.log(`  ✓ DTO найдено, парсим поля...`);
            // Парсим поля
            const lines = interfaceBody.split('\n');
            for (const line of lines) {
                const fieldMatch = line.match(/^\s*['"]?(\w+)['"]?\??:/);
                if (fieldMatch) {
                    fields.push(fieldMatch[1]);
                }
            }
            console.log(`  ✓ Извлечено полей: ${fields.length}`);
            fields.forEach(f => console.log(`      - ${f}`));
            return fields;
        }
        catch (error) {
            console.error(`  ❌ Ошибка при чтении DTO: ${error.message}`);
            return [];
        }
    }
    /**
     * ЭТАП 1: Находит таблицы по полям DTO
     */
    async findTablesByFields(dtoFields) {
        if (dtoFields.length === 0) {
            console.log('⚠️  Поля DTO не найдены, пропускаю schema analysis');
            return [];
        }
        console.log(`  🔍 Ищу таблицы для полей: ${dtoFields.join(', ')}`);
        // Получаем все таблицы и колонки
        try {
            const sqlQuery = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `;
            console.log('  📋 SQL запрос для получения схемы БД:');
            console.log('  ┌─────────────────────────────────────────────────────────────────┐');
            sqlQuery.split('\n').forEach(line => {
                if (line.trim()) {
                    console.log(`  │ ${line.padEnd(63)} │`);
                }
            });
            console.log('  └─────────────────────────────────────────────────────────────────┘');
            const result = await this.dbConnect `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `;
            console.log(`  ✓ Получено ${result.length} колонок из БД`);
            // Показываем первые 10 колонок для примера
            if (result.length > 0) {
                console.log('  📊 Примеры колонок из БД (первые 10):');
                result.slice(0, 10).forEach((row) => {
                    console.log(`      ${row.table_name}.${row.column_name} (${row.data_type})`);
                });
                if (result.length > 10) {
                    console.log(`      ... и еще ${result.length - 10} колонок`);
                }
            }
            // Группируем по таблицам
            const tableColumns = new Map();
            for (const row of result) {
                if (!tableColumns.has(row.table_name)) {
                    tableColumns.set(row.table_name, []);
                }
                tableColumns.get(row.table_name).push({
                    name: row.column_name,
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES',
                });
            }
            console.log(`  ✓ Найдено ${tableColumns.size} таблиц в БД`);
            console.log('');
            console.log('  🔎 ДЕТАЛЬНЫЙ АНАЛИЗ КАЖДОГО ПОЛЯ DTO:');
            console.log('  ═══════════════════════════════════════════════════════════════════');
            // Подсчитываем совпадения с детальным логированием
            const scores = [];
            for (const [tableName, columns] of tableColumns.entries()) {
                let matchCount = 0;
                const matchedFields = [];
                for (const dtoField of dtoFields) {
                    // Генерируем варианты имени поля
                    const variants = this.generateFieldVariants(dtoField);
                    console.log(`  📌 Поле DTO: "${dtoField}"`);
                    console.log(`     Генерирую варианты: ${variants.join(', ')}`);
                    // Ищем совпадение
                    const matchedColumn = columns.find(col => variants.includes(col.name));
                    if (matchedColumn) {
                        matchCount++;
                        matchedFields.push(`${dtoField} → ${matchedColumn.name}`);
                        console.log(`     ✓ НАЙДЕНО в таблице "${tableName}": ${matchedColumn.name}`);
                    }
                    else {
                        // Показываем что есть в таблице для отладки
                        const similarColumns = columns
                            .filter(col => {
                            const colLower = col.name.toLowerCase();
                            const fieldLower = dtoField.toLowerCase();
                            return colLower.includes(fieldLower) || fieldLower.includes(colLower);
                        })
                            .slice(0, 3);
                        if (similarColumns.length > 0) {
                            console.log(`     ⚠️  НЕ НАЙДЕНО в "${tableName}", но есть похожие:`);
                            similarColumns.forEach(col => {
                                console.log(`        - ${col.name}`);
                            });
                        }
                        else {
                            console.log(`     ✗ НЕ НАЙДЕНО в "${tableName}"`);
                        }
                    }
                    console.log('');
                }
                if (matchCount > 0) {
                    const confidence = matchCount / dtoFields.length;
                    console.log(`  ╔═══════════════════════════════════════════════════════════════╗`);
                    console.log(`  ║ 🎯 ТАБЛИЦА: ${tableName.padEnd(48)} ║`);
                    console.log(`  ║ Совпадений: ${matchCount}/${dtoFields.length} (${(confidence * 100).toFixed(0)}%)${' '.repeat(43 - matchCount.toString().length - dtoFields.length.toString().length)} ║`);
                    console.log(`  ╠═══════════════════════════════════════════════════════════════╣`);
                    matchedFields.forEach(m => {
                        console.log(`  ║ ✓ ${m.padEnd(60)} ║`);
                    });
                    console.log(`  ╚═══════════════════════════════════════════════════════════════╝`);
                    console.log('');
                    scores.push({
                        name: tableName,
                        columns,
                        foreignKeys: [], // Заполним позже
                        confidence
                    });
                }
            }
            if (scores.length === 0) {
                console.log('  ╔═══════════════════════════════════════════════════════════════╗');
                console.log('  ║ ⚠️  СОВПАДЕНИЙ НЕ НАЙДЕНО                                    ║');
                console.log('  ╚═══════════════════════════════════════════════════════════════╝');
                console.log('');
                console.log('  🔧 ОТЛАДОЧНАЯ ИНФОРМАЦИЯ:');
                console.log('');
                console.log('  📋 Ваши поля DTO:');
                dtoFields.forEach(field => {
                    console.log(`     - ${field}`);
                });
                console.log('');
                console.log('  🔄 Примеры генерируемых вариантов:');
                dtoFields.slice(0, 3).forEach(field => {
                    const variants = this.generateFieldVariants(field);
                    console.log(`     ${field} →`);
                    variants.forEach(v => {
                        console.log(`        - "${v}"`);
                    });
                });
                console.log('');
                console.log('  💡 ВОЗМОЖНЫЕ ПРОБЛЕМЫ:');
                console.log('     1. Naming convention отличается от стандартной');
                console.log('     2. Поля находятся в разных таблицах');
                console.log('     3. Имена полей в БД сильно отличаются от DTO');
                console.log('');
                console.log('  📝 РЕКОМЕНДАЦИИ:');
                console.log('     1. Проверьте реальные имена колонок в БД:');
                console.log('        SELECT column_name FROM information_schema.columns');
                console.log('        WHERE table_name = \'предполагаемая_таблица\';');
                console.log('');
                console.log('     2. Сравните с вашими полями DTO:');
                dtoFields.forEach(field => {
                    console.log(`        DTO: ${field} → БД: ${this.toSnakeCase(field)}`);
                });
                console.log('');
                console.log('     3. Если naming сильно отличается, используйте force: false');
                console.log('        и укажите таблицы вручную в тесте');
            }
            // Сортируем по confidence и возвращаем топ-10
            return scores
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 10);
        }
        catch (error) {
            console.error(`  ❌ Ошибка при чтении схемы БД: ${error.message}`);
            console.error(`  Stack: ${error.stack}`);
            return [];
        }
    }
    /**
     * Конвертирует camelCase в snake_case
     */
    toSnakeCase(str) {
        return str
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .replace(/^_/, '');
    }
    /**
     * Генерирует варианты имени поля (camelCase, snake_case, etc)
     */
    generateFieldVariants(field) {
        const variants = new Set();
        // 1. Оригинал
        variants.add(field);
        variants.add(field.toLowerCase());
        // 2. snake_case (правильная конвертация)
        // orderType → order_type
        // productId → product_id
        // regNumberS → reg_number_s
        const snakeCase = field
            .replace(/([A-Z])/g, (match, char, offset) => {
            // Если заглавная буква в начале, не добавляем подчеркивание
            return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
        });
        variants.add(snakeCase);
        // 3. Вариант с подчеркиванием в начале (на случай если было с заглавной)
        if (snakeCase.startsWith('_')) {
            variants.add(snakeCase.substring(1));
        }
        // 4. SCREAMING_SNAKE_CASE
        variants.add(snakeCase.toUpperCase());
        // 5. kebab-case
        const kebabCase = snakeCase.replace(/_/g, '-');
        variants.add(kebabCase);
        // 6. PascalCase
        const pascalCase = field.charAt(0).toUpperCase() + field.slice(1);
        variants.add(pascalCase);
        // 7. Plural формы
        variants.add(field + 's');
        variants.add(snakeCase + 's');
        variants.add(field.toLowerCase() + 's');
        // 8. Без последней буквы (для множественного числа)
        if (field.endsWith('s') || field.endsWith('S')) {
            const singular = field.slice(0, -1);
            variants.add(singular);
            variants.add(singular.toLowerCase());
            const singularSnake = singular
                .replace(/([A-Z])/g, (match, char, offset) => {
                return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
            });
            variants.add(singularSnake);
        }
        // 9. Без префиксов (is, has, get, set)
        const withoutPrefix = field.replace(/^(is|has|get|set|use|can|should)/, '');
        if (withoutPrefix !== field) {
            variants.add(withoutPrefix);
            variants.add(withoutPrefix.toLowerCase());
            const withoutPrefixSnake = withoutPrefix
                .replace(/([A-Z])/g, (match, char, offset) => {
                return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
            });
            variants.add(withoutPrefixSnake);
        }
        // 10. Без суффиксов (Id, ID, Type, Status, etc)
        const withoutSuffix = field
            .replace(/(Id|ID|Type|Status|Date|Time|At|By)$/, '');
        if (withoutSuffix !== field) {
            variants.add(withoutSuffix);
            variants.add(withoutSuffix.toLowerCase());
            const withoutSuffixSnake = withoutSuffix
                .replace(/([A-Z])/g, (match, char, offset) => {
                return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
            });
            variants.add(withoutSuffixSnake);
        }
        // 11. Альтернативные варианты для распространенных паттернов
        // userId → user_id, uid
        if (field.toLowerCase().endsWith('id')) {
            const base = field.slice(0, -2);
            const baseSnake = base
                .replace(/([A-Z])/g, (match, char, offset) => {
                return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
            });
            variants.add(baseSnake + '_id');
            variants.add(baseSnake + 'id');
            variants.add(base.toLowerCase() + '_id');
            variants.add(base.toLowerCase() + 'id');
        }
        // 12. Убираем пустые строки
        const result = Array.from(variants).filter(v => v.length > 0);
        return result;
    }
    /**
     * ЭТАП 2: Находит связанные таблицы через FK
     */
    async findRelatedTables(mainTables) {
        if (mainTables.length === 0)
            return [];
        const related = new Set();
        for (const table of mainTables) {
            // Прямые FK (куда ссылается эта таблица)
            const directFKs = await this.dbConnect `
        SELECT
          ccu.table_name AS foreign_table
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = ${table}
      `;
            directFKs.forEach((row) => related.add(row.foreign_table));
            // Обратные FK (кто ссылается на эту таблицу)
            const reverseFKs = await this.dbConnect `
        SELECT
          tc.table_name AS referencing_table
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = ${table}
      `;
            reverseFKs.forEach((row) => related.add(row.referencing_table));
        }
        // Убираем основные таблицы из результата
        mainTables.forEach(t => related.delete(t));
        return Array.from(related);
    }
    /**
     * ЭТАП 3: Подтверждает таблицы реальным вызовом endpoint
     */
    async confirmWithRealCall(endpoint, method, dtoFields, tablesToCheck) {
        if (tablesToCheck.length === 0) {
            console.log('⚠️  Нет таблиц для проверки');
            return [];
        }
        // 1. Снимаем snapshot ДО вызова
        console.log('  📸 Снимаем snapshot таблиц...');
        const before = {};
        for (const table of tablesToCheck) {
            try {
                const rows = await this.dbConnect `
          SELECT * FROM ${this.dbConnect(table)}
          ORDER BY id DESC
          LIMIT 10
        `;
                before[table] = rows;
            }
            catch (error) {
                console.warn(`  ⚠️  Не удалось прочитать таблицу ${table}`);
            }
        }
        // 2. Генерируем уникальные тестовые данные
        const uniqueData = this.generateUniqueTestData(dtoFields);
        console.log('  🎲 Сгенерированы уникальные данные');
        // 3. Вызываем endpoint
        console.log(`  📡 Вызываем ${method} ${endpoint}...`);
        let callSuccess = false;
        try {
            // Предполагаем что endpoint доступен через process.env.StandURL
            const baseUrl = process.env.StandURL || 'http://localhost:3000';
            const url = baseUrl + endpoint;
            if (method === 'GET') {
                await axios_1.default.get(url);
            }
            else if (method === 'POST') {
                await axios_1.default.post(url, uniqueData);
            }
            else if (method === 'PUT') {
                await axios_1.default.put(url, uniqueData);
            }
            else if (method === 'PATCH') {
                await axios_1.default.patch(url, uniqueData);
            }
            else if (method === 'DELETE') {
                await axios_1.default.delete(url);
            }
            callSuccess = true;
            console.log('  ✓ Endpoint вызван успешно');
        }
        catch (error) {
            console.warn(`  ⚠️  Endpoint вернул ошибку: ${error.response?.status || error.message}`);
            console.log('  ℹ️  Продолжаем анализ (данные могли быть записаны)');
        }
        // 4. Ждем немного (для асинхронных операций)
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 5. Снимаем snapshot ПОСЛЕ вызова
        console.log('  📸 Снимаем snapshot после вызова...');
        const after = {};
        for (const table of tablesToCheck) {
            try {
                const rows = await this.dbConnect `
          SELECT * FROM ${this.dbConnect(table)}
          ORDER BY id DESC
          LIMIT 10
        `;
                after[table] = rows;
            }
            catch (error) {
                // Игнорируем
            }
        }
        // 6. Детектим изменения
        const confirmed = [];
        const uniqueValues = Object.values(uniqueData).flat();
        for (const table of tablesToCheck) {
            if (!before[table] || !after[table])
                continue;
            // Ищем новые строки
            const newRows = after[table].filter(afterRow => !before[table].some(beforeRow => beforeRow.id === afterRow.id));
            if (newRows.length > 0) {
                // Проверяем что наши уникальные значения попали в таблицу
                const hasUniqueValues = newRows.some(row => Object.values(row).some(value => uniqueValues.some(uniqueVal => String(value).includes(String(uniqueVal)))));
                if (hasUniqueValues) {
                    confirmed.push(table);
                }
            }
        }
        return confirmed;
    }
    /**
     * Генерирует уникальные тестовые данные
     */
    generateUniqueTestData(dtoFields) {
        const timestamp = Date.now();
        const unique = {};
        for (const field of dtoFields) {
            const fieldLower = field.toLowerCase();
            // Определяем тип по имени поля
            if (fieldLower.includes('id') && fieldLower !== 'id') {
                unique[field] = 999900000 + (timestamp % 100000);
            }
            else if (fieldLower.includes('email')) {
                unique[field] = `test_${timestamp}@analyzer.test`;
            }
            else if (fieldLower.includes('phone')) {
                unique[field] = `+1${timestamp % 10000000000}`;
            }
            else if (fieldLower.includes('name')) {
                unique[field] = `TEST_${timestamp}_NAME`;
            }
            else if (fieldLower.includes('status')) {
                unique[field] = `TEST_STATUS_${timestamp}`;
            }
            else if (fieldLower.includes('amount') || fieldLower.includes('price')) {
                unique[field] = 999.99 + (timestamp % 100);
            }
            else if (fieldLower.includes('date') || fieldLower.includes('time')) {
                unique[field] = new Date().toISOString();
            }
            else if (fieldLower.includes('is') || fieldLower.includes('has')) {
                unique[field] = true;
            }
            else {
                unique[field] = `TEST_${timestamp}_${field.toUpperCase()}`;
            }
        }
        return unique;
    }
    /**
     * Генерирует тестовые данные для таблиц
     */
    async generateTestData(tables) {
        const testData = {};
        for (const table of tables) {
            try {
                if (this.config.dataStrategy === 'existing' || this.config.dataStrategy === 'both') {
                    // Берем существующие данные
                    const existing = await this.dbConnect `
            SELECT * FROM ${this.dbConnect(table)}
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT ${this.config.samplesCount}
          `;
                    if (existing.length > 0) {
                        testData[table] = existing.map((row) => this.sanitizeRow(row));
                        console.log(`  ✓ ${table}: ${existing.length} записей из БД`);
                    }
                    else {
                        console.log(`  ⚠️  ${table}: нет данных в БД`);
                    }
                }
                // TODO: Реализовать генерацию новых данных если нужно
                if (this.config.dataStrategy === 'generate') {
                    console.log(`  ℹ️  Генерация новых данных пока не реализована`);
                }
            }
            catch (error) {
                console.warn(`  ⚠️  Ошибка при получении данных из ${table}: ${error.message}`);
            }
        }
        return testData;
    }
    /**
     * Очищает строку от служебных полей
     */
    sanitizeRow(row) {
        const sanitized = {};
        for (const [key, value] of Object.entries(row)) {
            // Пропускаем служебные поля
            if (['created_at', 'updated_at', 'deleted_at'].includes(key)) {
                continue;
            }
            // Преобразуем даты в строки
            if (value instanceof Date) {
                sanitized[key] = value.toISOString();
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    /**
     * Обновляет тест файл с найденными таблицами и данными
     */
    async updateTestFile(tables, testData) {
        let content = fs.readFileSync(this.config.testFilePath, 'utf-8');
        // 1. Обновляем список таблиц
        const tablesArray = tables.map(t => `'${t}'`).join(', ');
        content = content.replace(/\/\/ @db-tables:start\s*\n.*?const dbTables.*?=.*?\[.*?\];.*?\n\/\/ @db-tables:end/s, `// @db-tables:start\nconst dbTables: string[] = [${tablesArray}];\n// @db-tables:end`);
        // 2. Добавляем/обновляем секцию с тестовыми данными
        const dataSection = this.generateTestDataSection(testData);
        // Ищем существующую секцию
        if (content.includes('// @test-data:start')) {
            content = content.replace(/\/\/ @test-data:start[\s\S]*?\/\/ @test-data:end/, dataSection);
        }
        else {
            // Добавляем после dbTables
            const insertPos = content.indexOf('// @db-tables:end') + '// @db-tables:end'.length;
            content = content.slice(0, insertPos) + '\n\n' + dataSection + content.slice(insertPos);
        }
        // 3. Сохраняем файл
        fs.writeFileSync(this.config.testFilePath, content);
    }
    /**
     * Генерирует секцию с тестовыми данными
     */
    generateTestDataSection(testData) {
        const lines = [];
        lines.push('// @test-data:start');
        lines.push('// Тестовые данные из БД (автоматически сгенерировано)');
        lines.push('/* @protected:start:dbTestData */');
        lines.push('const dbTestData = {');
        const tableNames = Object.keys(testData);
        tableNames.forEach((tableName, tableIndex) => {
            const rows = testData[tableName];
            lines.push(`  ${tableName}: [`);
            rows.forEach((row, rowIndex) => {
                const rowStr = JSON.stringify(row, null, 4);
                const comma = rowIndex < rows.length - 1 ? ',' : '';
                lines.push(`    ${rowStr}${comma}`);
            });
            const comma = tableIndex < tableNames.length - 1 ? ',' : '';
            lines.push(`  ]${comma}`);
        });
        lines.push('};');
        lines.push('/* @protected:end:dbTestData */');
        lines.push('// @test-data:end');
        return lines.join('\n');
    }
}
exports.DatabaseAnalyzer = DatabaseAnalyzer;
/**
 * Основная функция для анализа и генерации тестовых данных
 */
async function analyzeAndGenerateTestData(config, dbConnectFunction) {
    const analyzer = new DatabaseAnalyzer(config, dbConnectFunction);
    return await analyzer.analyze();
}
//# sourceMappingURL=database-analyzer.js.map