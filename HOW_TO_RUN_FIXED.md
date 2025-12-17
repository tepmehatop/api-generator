# ✅ ИСПРАВЛЕНО: Правильный способ запуска

## Проблема

`npx api-codegen generate` не работает при локальной разработке, потому что пакет не установлен глобально.

## ✅ Решение: Используйте npm scripts

### Для локальной разработки

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/your-company/api-codegen.git
cd api-codegen

# 2. Установите зависимости
npm install

# 3. Соберите проект
npm run build

# 4. Создайте конфиг файл
cp codegen.config.example.json codegen.config.json
# Отредактируйте codegen.config.json с вашими настройками

# 5. Запустите генерацию
npm run generate

# Или с кастомным конфигом
npm run generate -- --config=./my-config.json

# Справка
npm run generate:help
```

### Для Jenkins

**Вариант 1: Через npm scripts (рекомендуется)**

```groovy
stage('Generate API') {
    steps {
        sh 'npm install'
        sh 'npm run build'
        
        // Создаём конфиг
        sh '''
cat > codegen.config.json << EOF
{
  "specUrl": "${OPENAPI_URL}",
  "outputDir": "./api"
}
EOF
        '''
        
        // Генерируем
        sh 'npm run generate'
    }
}
```

**Вариант 2: Напрямую через node (после публикации)**

После публикации пакета в NPM, можно использовать:

```bash
npx api-codegen generate
```

Но это работает только ПОСЛЕ того как пакет опубликован!

## 📋 Доступные команды

### npm run build
Компилирует TypeScript → создаёт `/dist`

### npm run generate
Запускает генерацию API из конфига `codegen.config.json`

### npm run generate -- --config=PATH
Запускает генерацию с кастомным конфигом

### npm run generate:help
Показывает справку

### npm run clean
Удаляет папку `dist/`

### npm run dev
Компилирует TypeScript в watch режиме

## 🔧 Структура конфига

**codegen.config.json:**
```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL",
  "authTokenVar": "process.env.AUTH_TOKEN",
  "generateErrorHandlers": true,
  "generateTypes": true,
  "transliterateRussian": true,
  "useClasses": false
}
```

## 📊 Полный workflow

### РАЗРАБОТКА

```bash
# Клонируем
git clone https://github.com/your-company/api-codegen.git
cd api-codegen

# Устанавливаем зависимости
npm install

# Собираем
npm run build

# Создаём конфиг
cat > codegen.config.json << EOF
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./api"
}
EOF

# Генерируем
npm run generate

# Проверяем результат
ls -la ./api/

# Публикуем
npm version patch
npm publish
```

### JENKINS

```groovy
pipeline {
    agent any
    
    environment {
        NPM_REGISTRY = 'https://your-npm-registry.com/'
        NPM_TOKEN = credentials('npm-token')
        OPENAPI_URL = 'https://api.example.com/openapi.json'
    }
    
    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/your-company/api-codegen.git'
            }
        }
        
        stage('Install') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
        
        stage('Generate API') {
            steps {
                // Создаём конфиг
                sh '''
cat > codegen.config.json << EOF
{
  "specUrl": "${OPENAPI_URL}",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL"
}
EOF
                '''
                
                // Генерируем через npm script
                sh 'npm run generate'
                
                // Проверяем что файлы созданы
                sh 'ls -la ./api/'
            }
        }
        
        stage('Publish') {
            steps {
                sh '''
                    echo "//your-npm-registry.com/:_authToken=${NPM_TOKEN}" > .npmrc
                    npm publish --registry=${NPM_REGISTRY}
                '''
            }
        }
    }
    
    post {
        success {
            echo "✅ Package published!"
            echo "Contains /api with generated methods"
        }
        always {
            sh 'rm -f .npmrc'
        }
    }
}
```

### ИСПОЛЬЗОВАНИЕ ПОСЛЕ ПУБЛИКАЦИИ

После того как пакет опубликован, в других проектах можно использовать:

```bash
# Установка
npm install @your-company/api-codegen

# Теперь работает npx
npx api-codegen generate

# Или импорт в коде
import { createOrder } from '@your-company/api-codegen/api/orders.api';
import { generateApiTests } from '@your-company/api-codegen';
```

## ⚠️ Важно!

### ❌ НЕ работает в локальной разработке:
```bash
npx api-codegen generate  # ← Не работает, пакет не установлен!
```

### ✅ Работает в локальной разработке:
```bash
npm run generate  # ← Работает!
```

### ✅ Работает после публикации:
```bash
npm install @your-company/api-codegen
npx api-codegen generate  # ← Теперь работает!
```

## 🧪 Тестирование

### Локально

```bash
# Проверка что команды работают
npm run generate:help

# Создание тестового конфига
cat > codegen.config.json << EOF
{
  "specUrl": "./test/fixtures/openapi.json",
  "outputDir": "./api"
}
EOF

# Генерация (с локальным файлом)
npm run generate

# Проверка результата
ls -la ./api/
```

### После публикации

```bash
# В тестовом проекте
mkdir test-project
cd test-project
npm init -y
npm install @your-company/api-codegen

# Проверка CLI
npx api-codegen --help

# Проверка импортов
node -e "console.log(require('@your-company/api-codegen'))"
```

## 📝 Резюме

| Ситуация | Команда |
|----------|---------|
| Локальная разработка | `npm run generate` |
| Jenkins | `npm run generate` |
| После публикации | `npx api-codegen generate` |

✅ **Всегда используйте `npm run generate` в Jenkins!**
