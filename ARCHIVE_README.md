# Archive - Версии пакетов для сравнения

Эта папка содержит архивы (.tgz) предыдущих версий пакета для сравнения изменений API.

## Зачем это нужно?

При генерации нового API мы можем сравнить его с предыдущей версией и создать отчёт об изменениях:
- Новые endpoints
- Удалённые endpoints
- Изменённые DTO

## Как использовать

### 1. После публикации новой версии

```bash
# Создаём архив
npm pack

# Сохраняем в archive/
mv api-codegen-1.55.0.tgz archive/

# Коммитим
git add archive/
git commit -m "archive: version 1.55.0"
git push
```

### 2. При генерации следующей версии

В конфиге укажите путь к предыдущей версии:

```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "./archive/api-codegen-1.55.0.tgz"
}
```

### 3. Запустите генерацию

```bash
npm run generate -- --config=configs/orders_config.json
```

Будет создан файл `dist/orders/COMPARE_README.md` с отчётом об изменениях!

## Версии

| Версия | Дата | Описание |
|--------|------|----------|
| 1.55.0 | 2024-12-20 | Добавлен cancelOrder endpoint |
| 1.54.0 | 2024-12-15 | Исправлен OrderResponse DTO |
| 1.53.0 | 2024-12-10 | Начальная версия |

## Очистка старых версий

Рекомендуется хранить только последние 5-10 версий:

```bash
cd archive

# Удаляем версии старше 10-й
ls -t *.tgz | tail -n +11 | xargs rm -f

# Коммитим
git add .
git commit -m "chore: cleanup old archives"
git push
```

## Размер файлов

Обычно каждый архив занимает 50-200 KB.

Последние 10 версий ≈ 1-2 MB в Git репозитории.

## Автоматизация в Jenkins

```groovy
stage('Archive Version') {
    steps {
        script {
            def version = sh(
                script: 'node -p "require(\'./package.json\').version"',
                returnStdout: true
            ).trim()
            
            sh """
                npm pack
                mv api-codegen-${version}.tgz archive/
                git add archive/
                git commit -m "archive: version ${version}"
                git push
            """
        }
    }
}
```

## Troubleshooting

### Файл не найден?

```bash
# Проверьте что файл существует
ls -lh archive/

# Проверьте путь в конфиге
cat configs/orders_config.json | grep prevPackage
```

### Git не коммитит .tgz?

Проверьте `.gitignore`:

```bash
# Убедитесь что archive/*.tgz НЕ игнорируется
grep -v "^#" .gitignore | grep "\.tgz"

# Если нужно, добавьте исключение
echo "!archive/*.tgz" >> .gitignore
```
