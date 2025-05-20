// middleware/requestLogger.js
/**
 * Middleware для логирования всех HTTP запросов к API
 * Добавляет подробную информацию о запросах в консоль бэкенда
 */

const requestLogger = (req, res, next) => {
  // Сохраняем время начала запроса
  const startTime = Date.now();
  
  // Получаем основную информацию о запросе
  const { method, originalUrl, ip, headers } = req;
  
  // Форматируем заголовки для логирования (можно выбрать нужные)
  const relevantHeaders = {
    'user-agent': headers['user-agent'],
    'content-type': headers['content-type'],
    'accept': headers.accept,
    'referer': headers.referer
  };
  
  // Создаем копию body для логирования (может содержать конфиденциальные данные)
  // Для продакшена можно скрыть определенные поля
  const bodyToLog = hideConfidentialData({ ...req.body });
  
  // Логируем начало запроса
  console.log('\n----- INCOMING REQUEST -----');
  console.log(`[${new Date().toISOString()}] ${method} ${originalUrl}`);
  console.log(`IP: ${ip}`);
  console.log('Headers:', JSON.stringify(relevantHeaders, null, 2));
  
  // Логируем параметры запроса
  if (Object.keys(req.query).length > 0) {
    console.log('Query params:', JSON.stringify(req.query, null, 2));
  }
  
  // Логируем тело запроса для POST, PUT, PATCH
  if (['POST', 'PUT', 'PATCH'].includes(method) && Object.keys(bodyToLog).length > 0) {
    console.log('Body:', JSON.stringify(bodyToLog, null, 2));
  }
  
  // Перехватываем стандартные методы отправки ответа
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;
  
  // Перехватываем res.send()
  res.send = function(body) {
    logResponse(res, body, startTime);
    return originalSend.apply(res, arguments);
  };
  
  // Перехватываем res.json()
  res.json = function(body) {
    logResponse(res, body, startTime);
    return originalJson.apply(res, arguments);
  };
  
  // Перехватываем res.end()
  res.end = function(chunk) {
    if (chunk) {
      logResponse(res, chunk, startTime);
    } else {
      logResponse(res, null, startTime);
    }
    return originalEnd.apply(res, arguments);
  };
  
  // Продолжаем обработку запроса
  next();
};

/**
 * Скрывает конфиденциальные данные из запроса
 * @param {Object} data - Данные запроса
 * @returns {Object} - Данные с скрытыми конфиденциальными полями
 */
function hideConfidentialData(data) {
  if (!data) return {};
  
  const sensitiveFields = ['password', 'secretKey', 'apiKey', 'token', 'passphrase'];
  const result = { ...data };
  
  // Маскируем конфиденциальные поля
  for (const field of sensitiveFields) {
    if (result[field]) {
      result[field] = '******';
    }
  }
  
  return result;
}

/**
 * Логирует данные ответа
 * @param {Object} res - Объект ответа Express
 * @param {*} body - Тело ответа
 * @param {number} startTime - Время начала запроса
 */
function logResponse(res, body, startTime) {
  // Вычисляем длительность запроса
  const duration = Date.now() - startTime;
  
  // Форматируем ответ для лога
  let responseBody = body;
  
  if (typeof body === 'string') {
    try {
      // Пробуем распарсить JSON строку
      responseBody = JSON.parse(body);
    } catch (e) {
      // Если не JSON, оставляем как есть но обрезаем при большой длине
      if (body.length > 500) {
        responseBody = body.substring(0, 500) + '... [truncated]';
      }
    }
  }
  
  // Логируем ответ
  console.log('----- RESPONSE -----');
  console.log(`Status: ${res.statusCode}`);
  console.log(`Duration: ${duration}ms`);
  
  // Для ошибок логируем полное тело ответа
  if (res.statusCode >= 400) {
    console.log('Response body:', JSON.stringify(responseBody, null, 2));
  } else {
    // Для успешных запросов можно ограничить объем логов
    console.log('Response: Success');
    
    // Опционально можно включить для отладки
    // console.log('Response body:', JSON.stringify(responseBody, null, 2));
  }
  console.log('----- END REQUEST -----\n');
}

module.exports = requestLogger;
