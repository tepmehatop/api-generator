-- SQL скрипт для создания таблиц для хранения API данных из автотестов
-- Схема: qa
-- База: PostgreSQL

-- Создаём схему если не существует
CREATE SCHEMA IF NOT EXISTS qa;

-- Таблица для хранения собранных API запросов/ответов
CREATE TABLE IF NOT EXISTS qa.api_requests (
    id BIGSERIAL PRIMARY KEY,
    
    -- Информация о endpoint
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS')),
    
    -- Request/Response данные
    request_body JSONB,
    response_body JSONB,
    response_status INTEGER NOT NULL,
    
    -- Информация о тесте
    test_name VARCHAR(500),
    test_file VARCHAR(1000),
    
    -- Отслеживание генерации тестов
    test_generated BOOLEAN DEFAULT FALSE,
    test_file_path VARCHAR(1000),
    generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL, -- Когда был выполнен запрос
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Когда запись создана в БД
    
    -- Индексы для быстрого поиска
    CONSTRAINT api_requests_method_check CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'))
);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE qa.api_requests IS 'Собранные API запросы/ответы из UI автотестов';
COMMENT ON COLUMN qa.api_requests.endpoint IS 'URL path endpoint (например: /api/v1/orders)';
COMMENT ON COLUMN qa.api_requests.method IS 'HTTP метод (GET, POST, PUT, DELETE, PATCH)';
COMMENT ON COLUMN qa.api_requests.request_body IS 'Request body в формате JSON';
COMMENT ON COLUMN qa.api_requests.response_body IS 'Response body в формате JSON';
COMMENT ON COLUMN qa.api_requests.response_status IS 'HTTP status code ответа';
COMMENT ON COLUMN qa.api_requests.test_name IS 'Название теста из которого собраны данные';
COMMENT ON COLUMN qa.api_requests.test_file IS 'Файл теста';
COMMENT ON COLUMN qa.api_requests.test_generated IS 'Был ли сгенерирован тест для этих данных';
COMMENT ON COLUMN qa.api_requests.test_file_path IS 'Путь к сгенерированному тестовому файлу';
COMMENT ON COLUMN qa.api_requests.generated_at IS 'Когда был сгенерирован тест';
COMMENT ON COLUMN qa.api_requests.timestamp IS 'Когда был выполнен API запрос';
COMMENT ON COLUMN qa.api_requests.created_at IS 'Когда запись создана в БД';

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_api_requests_endpoint ON qa.api_requests(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_requests_method ON qa.api_requests(method);
CREATE INDEX IF NOT EXISTS idx_api_requests_endpoint_method ON qa.api_requests(endpoint, method);
CREATE INDEX IF NOT EXISTS idx_api_requests_status ON qa.api_requests(response_status);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON qa.api_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_requests_test_name ON qa.api_requests(test_name);
CREATE INDEX IF NOT EXISTS idx_api_requests_test_generated ON qa.api_requests(test_generated) WHERE test_generated = FALSE;

-- GIN индекс для поиска по JSONB полям
CREATE INDEX IF NOT EXISTS idx_api_requests_request_body_gin ON qa.api_requests USING GIN(request_body);
CREATE INDEX IF NOT EXISTS idx_api_requests_response_body_gin ON qa.api_requests USING GIN(response_body);

-- Создаём представление для уникальных endpoint + request комбинаций
CREATE OR REPLACE VIEW qa.unique_api_requests AS
SELECT DISTINCT ON (endpoint, method, request_body)
    id,
    endpoint,
    method,
    request_body,
    response_body,
    response_status,
    test_name,
    test_file,
    timestamp,
    created_at
FROM qa.api_requests
WHERE response_status >= 200 AND response_status < 300 -- Только успешные ответы
ORDER BY endpoint, method, request_body, created_at DESC;

COMMENT ON VIEW qa.unique_api_requests IS 'Уникальные комбинации endpoint + method + request_body для генерации тестов';

-- Создаём представление для статистики по endpoint'ам
CREATE OR REPLACE VIEW qa.api_endpoints_stats AS
SELECT 
    endpoint,
    method,
    COUNT(*) as total_requests,
    COUNT(DISTINCT request_body) as unique_requests,
    AVG(response_status) as avg_status,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen,
    ARRAY_AGG(DISTINCT test_name ORDER BY test_name) as test_names
FROM qa.api_requests
GROUP BY endpoint, method
ORDER BY total_requests DESC;

COMMENT ON VIEW qa.api_endpoints_stats IS 'Статистика по endpoint: количество запросов, уникальные request body, etc.';

-- Функция для очистки старых данных (опционально)
CREATE OR REPLACE FUNCTION qa.cleanup_old_api_requests(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM qa.api_requests
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION qa.cleanup_old_api_requests IS 'Удаляет записи старше указанного количества дней. По умолчанию 30 дней.';

-- Пример использования функции очистки:
-- SELECT qa.cleanup_old_api_requests(30); -- Удалит данные старше 30 дней

-- Функция для получения уникальных запросов по endpoint
CREATE OR REPLACE FUNCTION qa.get_unique_requests_for_endpoint(
    p_endpoint VARCHAR,
    p_method VARCHAR DEFAULT NULL
)
RETURNS TABLE(
    id BIGINT,
    endpoint VARCHAR,
    method VARCHAR,
    request_body JSONB,
    response_body JSONB,
    response_status INTEGER,
    test_name VARCHAR
) AS $$
BEGIN
    IF p_method IS NULL THEN
        RETURN QUERY
        SELECT DISTINCT ON (r.request_body)
            r.id,
            r.endpoint,
            r.method,
            r.request_body,
            r.response_body,
            r.response_status,
            r.test_name
        FROM qa.api_requests r
        WHERE r.endpoint = p_endpoint
          AND r.response_status >= 200 
          AND r.response_status < 300
        ORDER BY r.request_body, r.created_at DESC;
    ELSE
        RETURN QUERY
        SELECT DISTINCT ON (r.request_body)
            r.id,
            r.endpoint,
            r.method,
            r.request_body,
            r.response_body,
            r.response_status,
            r.test_name
        FROM qa.api_requests r
        WHERE r.endpoint = p_endpoint
          AND r.method = p_method
          AND r.response_status >= 200 
          AND r.response_status < 300
        ORDER BY r.request_body, r.created_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION qa.get_unique_requests_for_endpoint IS 'Возвращает уникальные request body для endpoint (для генерации тестов)';

-- Примеры использования функции:
-- SELECT * FROM qa.get_unique_requests_for_endpoint('/api/v1/orders');
-- SELECT * FROM qa.get_unique_requests_for_endpoint('/api/v1/orders', 'POST');

-- Создаём индекс для быстрого поиска дубликатов
CREATE INDEX IF NOT EXISTS idx_api_requests_duplicate_check 
ON qa.api_requests(endpoint, method, (request_body::text));

-- Вывод информации о созданных объектах
DO $$
BEGIN
    RAISE NOTICE '✓ Схема qa создана';
    RAISE NOTICE '✓ Таблица qa.api_requests создана';
    RAISE NOTICE '✓ Индексы созданы (7 индексов)';
    RAISE NOTICE '✓ Представления созданы (2 представления)';
    RAISE NOTICE '✓ Функции созданы (2 функции)';
    RAISE NOTICE '';
    RAISE NOTICE 'Готово! Можно начинать сбор данных.';
END $$;
