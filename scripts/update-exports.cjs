#!/usr/bin/env node

/**
 * Автоматически обновляет package.json exports
 * для всех сгенерированных API папок в dist/
 * 
 * Использование: node scripts/update-exports.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Сканирую dist/ для обновления exports...');

// Читаем package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Ищем все папки в dist/ (исключая служебные)
const distPath = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distPath)) {
  console.log('⚠️  dist/ не найден. Сначала выполните npm run build');
  process.exit(0);
}

const distItems = fs.readdirSync(distPath, { withFileTypes: true });

// Служебные файлы/папки которые не являются API
const excludeItems = [
  'index.js', 
  'index.d.ts', 
  'index.js.map',
  'index.d.ts.map',
  'generator.js',
  'generator.d.ts',
  'parser.js',
  'parser.d.ts',
  'test-generator.js',
  'test-generator.d.ts',
  'database-analyzer.js',
  'database-analyzer.d.ts',
  'http-client.js',
  'http-client.d.ts',
  'example.js',
  'example.d.ts',
  'utils'
];

// Находим все API папки
const apiFolders = distItems
  .filter(item => item.isDirectory())
  .filter(item => !excludeItems.includes(item.name))
  .map(item => item.name);

console.log(`✓ Найдено API папок: ${apiFolders.length}`);
apiFolders.forEach(folder => console.log(`  - ${folder}`));

if (apiFolders.length === 0) {
  console.log('⚠️  API папки не найдены в dist/');
  console.log('💡 Запустите: npm run generate');
  process.exit(0);
}

// Создаем exports
const packageExports = {
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
};

// Добавляем каждую API папку
for (const folder of apiFolders) {
  // Проверяем есть ли index.ts в папке
  const indexPath = path.join(distPath, folder, 'index.ts');
  const hasIndex = fs.existsSync(indexPath);
  
  if (hasIndex) {
    // Barrel export через index.ts
    packageExports[`./${folder}`] = {
      "types": `./dist/${folder}/index.d.ts`,
      "default": `./dist/${folder}/index.js`
    };
  }
  
  // Прямой доступ к файлам
  packageExports[`./${folder}/*`] = {
    "types": `./dist/${folder}/*.d.ts`,
    "default": `./dist/${folder}/*.js`
  };
  
  console.log(`  ✓ Добавлен export: ./${folder}`);
}

// Обновляем package.json
packageJson.exports = packageExports;

// Сохраняем с красивым форматированием
fs.writeFileSync(
  packageJsonPath, 
  JSON.stringify(packageJson, null, 2) + '\n',
  'utf-8'
);

console.log('');
console.log('✅ package.json обновлен!');
console.log('');
console.log('Exports:');
Object.keys(packageExports).forEach(key => {
  console.log(`  "${key}"`);
});
console.log('');
