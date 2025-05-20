const TradingApp = require('./app');

async function startServer() {
  try {
    // Создаем экземпляр приложения
    const tradingApp = new TradingApp();
    
    // Инициализируем приложение
    console.log("Инициализация торгового приложения...");
    await tradingApp.initialize();
    
    // Запускаем сервер на порту 4000
    console.log("Запуск сервера на порту 4000...");
    tradingApp.start(4000);
  } catch (error) {
    console.error('Ошибка при запуске сервера:', error);
    process.exit(1);
  }
}

// Запускаем сервер
startServer();