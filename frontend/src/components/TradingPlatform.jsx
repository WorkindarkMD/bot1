import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Bell, Settings, User, BarChart2, TrendingUp, Inbox, Activity, 
  Zap, Grid, DollarSign, LogOut, Home, RefreshCw, Search, 
  ChevronDown
} from 'lucide-react';

import useApi from '../hooks/useApi';
import DashboardContent from './dashboard/DashboardContent';
import ChartContent from './chart/ChartContent';
import SignalsContent from './signals/SignalsContent';
import CopyTradingContent from './copytrading/CopyTradingContent';
import SmartGridContent from './smartgrid/SmartGridContent';
import PositionsContent from './positions/PositionsContent';
import AnalyticsContent from './analytics/AnalyticsContent';
import SettingsModal from './common/SettingsModal';

const TradingPlatform = () => {
  // Refs для доступа к методам виджета TradingView
  const dashboardRef = useRef(null);
  const chartRef = useRef(null);
  
  // Состояние
  const [activeModule, setActiveModule] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState('ru');
  const [darkMode, setDarkMode] = useState(true);
  const [pairSearch, setPairSearch] = useState('');
  
  // Redux state
  const dispatch = useDispatch();
  const exchange = useSelector(state => state.exchange);
  const marketType = useSelector(state => state.marketType);
  const interval = useSelector(state => state.interval);
  const currentPair = useSelector(state => state.currentPair);
  const pairs = useSelector(state => state.pairs);
  const isLoading = useSelector(state => state.isLoading);
  const status = useSelector(state => state.status);
  
  // API Hooks
  const { 
    initializeAppData, 
    changeExchange, 
    changePair, 
    changeInterval, 
    fetchPairs
  } = useApi();

  // Инициализация системы при загрузке
  useEffect(() => {
    const initApp = async () => {
      console.log('Инициализация приложения...');
      
      try {
        await initializeAppData();
        console.log('Инициализация завершена');
      } catch (error) {
        console.error('Ошибка при инициализации приложения:', error);
      }
    };
    
    initApp();
  }, []);

  // Функция для рендеринга опций торговых пар
  const renderPairOption = (pair, index) => {
    // Для строковых значений
    if (typeof pair === 'string') {
      return <option key={`str-${pair}`} value={pair}>{pair}</option>;
    }
    
    // Для объектов с определенной структурой (как в ваших API-ответах)
    if (typeof pair === 'object' && pair !== null) {
      // Для формата из скриншота (baseAsset + quoteAsset)
      if (pair.baseAsset && pair.quoteAsset) {
        const pairSymbol = `${pair.baseAsset}${pair.quoteAsset}`;
        return <option key={`pair-${pairSymbol}-${index}`} value={pairSymbol}>{pairSymbol}</option>;
      }
      
      // Для пар с уже готовым символом
      if (pair.symbol) {
        return <option key={`symbol-${pair.symbol}`} value={pair.symbol}>{pair.symbol}</option>;
      }
    }
    
    // Для непредвиденных форматов
    return null;
  };

  // Эффекты
  // Фильтрация торговых пар
  const [filteredPairs, setFilteredPairs] = useState([]);
  
  useEffect(() => {
    if (!Array.isArray(pairs)) {
      console.warn('pairs is not an array:', pairs);
      setFilteredPairs([]);
      return;
    }
    
    if (pairSearch.trim() === '') {
      setFilteredPairs(pairs);
    } else {
      setFilteredPairs(
        pairs.filter(pair => {
          if (typeof pair === 'string') {
            return pair.toLowerCase().includes(pairSearch.toLowerCase());
          } else if (typeof pair === 'object' && pair !== null) {
            // Проверяем различные форматы объектов пар
            if (pair.symbol) {
              return pair.symbol.toLowerCase().includes(pairSearch.toLowerCase());
            } else if (pair.baseAsset && pair.quoteAsset) {
              const fullSymbol = `${pair.baseAsset}${pair.quoteAsset}`;
              return fullSymbol.toLowerCase().includes(pairSearch.toLowerCase());
            } else {
              const pairStr = JSON.stringify(pair);
              return pairStr.toLowerCase().includes(pairSearch.toLowerCase());
            }
          }
          return false;
        })
      );
    }
  }, [pairSearch, pairs]);

  // Функция для синхронизации данных с виджетом TradingView
  const syncTradingViewWidgets = (action, value) => {
    console.log(`Синхронизация виджетов TradingView: ${action} = ${value}`);
    
    // Обновляем все активные виджеты
    try {
      // Обновляем виджет на панели Dashboard, если он существует
      if (dashboardRef.current && dashboardRef.current.tradingViewRef) {
        if (action === 'changeSymbol') {
          dashboardRef.current.tradingViewRef.changeSymbol(value);
        } else if (action === 'changeInterval') {
          dashboardRef.current.tradingViewRef.changeInterval(value);
        }
      }
      
      // Обновляем виджет на панели Chart, если он существует
      if (chartRef.current && chartRef.current.tradingViewRef) {
        if (action === 'changeSymbol') {
          chartRef.current.tradingViewRef.changeSymbol(value);
        } else if (action === 'changeInterval') {
          chartRef.current.tradingViewRef.changeInterval(value);
        }
      }
    } catch (error) {
      console.error(`Ошибка при синхронизации виджетов TradingView:`, error);
    }
  };

  // Функции
  const handleChangeExchange = (e) => {
    changeExchange(e.target.value);
  };

  const handleChangeMarketType = (type) => {
  dispatch({ type: 'SET_MARKET_TYPE', payload: type });
  let productType;
  if (type === 'futures' && exchange === 'bitget') {
    productType = 'umcbl';
  }
  console.log('Вызов fetchPairs с:', exchange, type, productType);
  fetchPairs(exchange, type, productType);
};

  const handleChangePair = (e) => {
    const newPair = e.target.value;
    changePair(newPair);
    
    // Синхронизируем виджеты TradingView
    syncTradingViewWidgets('changeSymbol', newPair);
  };

  const handleChangeInterval = (newInterval) => {
    changeInterval(newInterval);
    
    // Синхронизируем виджеты TradingView
    syncTradingViewWidgets('changeInterval', newInterval);
  };

  // Обработчики событий из виджета TradingView (обратного вызова из дочерних компонентов)
  const handleSymbolChangeFromWidget = (newSymbol) => {
    // Обновляем состояние в Redux только если текущее значение отличается от нового
    if (currentPair !== newSymbol) {
      changePair(newSymbol);
    }
  };
  
  const handleIntervalChangeFromWidget = (newInterval) => {
    // Обновляем состояние в Redux только если текущее значение отличается от нового
    if (interval !== newInterval) {
      changeInterval(newInterval);
    }
  };

  // Рендер активного модуля с передачей пропсов и ссылок
  const renderActiveModule = () => {
    const commonProps = {
      onSymbolChange: handleSymbolChangeFromWidget,
      onIntervalChange: handleIntervalChangeFromWidget,
    };
    
    switch (activeModule) {
      case 'dashboard':
        return <DashboardContent {...commonProps} ref={dashboardRef} id="dashboard-container" />;
      case 'chart':
        return <ChartContent {...commonProps} ref={chartRef} id="chart-container" />;
      case 'signals':
        return <SignalsContent />;
      case 'copytrading':
        return <CopyTradingContent />;
      case 'smartgrid':
        return <SmartGridContent />;
      case 'positions':
        return <PositionsContent />;
      case 'analytics':
        return <AnalyticsContent />;
      default:
        return <DashboardContent {...commonProps} ref={dashboardRef} id="dashboard-container" />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Верхняя панель навигации */}
      <header className="bg-gray-800 px-6 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-bold text-blue-400">TRADING</span>
          <span className="text-xl font-bold text-white">PLATFORM</span>
        </div>
        <div className="flex space-x-4 items-center">
          <div className="flex items-center space-x-2 mr-3">
            <select 
              className="bg-gray-700 text-white px-2 py-1 rounded-lg border border-gray-600 text-sm" 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
            <button 
              className={`p-1 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-400'}`} 
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? '🌙' : '☀️'}
            </button>
          </div>
          <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm flex items-center">
            <span className="h-2 w-2 bg-green-400 rounded-full mr-2"></span>
            СОСТОЯНИЕ: {status?.initialized ? 'АКТИВНО' : 'ИНИЦИАЛИЗАЦИЯ...'}
          </div>
          <button className="p-2 text-gray-400 hover:text-white">
            <User size={20} />
          </button>
          <button 
            className="p-2 text-gray-400 hover:text-white"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={20} />
          </button>
          <button className="p-2 text-gray-400 hover:text-white relative">
            <Bell size={20} />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <div className="flex flex-1 overflow-hidden">
        {/* Боковая панель навигации */}
        <nav className="w-64 bg-gray-800 p-4 overflow-y-auto">
          <div className="space-y-2">
            <button 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${activeModule === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setActiveModule('dashboard')}
            >
              <Home size={18} />
              <span>Главная</span>
            </button>
            <button 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${activeModule === 'chart' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setActiveModule('chart')}
            >
              <TrendingUp size={18} />
              <span>График</span>
            </button>
            <button 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${activeModule === 'signals' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setActiveModule('signals')}
            >
              <Zap size={18} />
              <span>Сигналы</span>
            </button>
            <button 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${activeModule === 'copytrading' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setActiveModule('copytrading')}
            >
              <Activity size={18} />
              <span>Копитрейдинг + AI</span>
            </button>
            <button 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${activeModule === 'smartgrid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setActiveModule('smartgrid')}
            >
              <Grid size={18} />
              <span>Adaptive Smart Grid</span>
            </button>
            <button 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${activeModule === 'positions' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setActiveModule('positions')}
            >
              <DollarSign size={18} />
              <span>Позиции</span>
            </button>
            <button 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${activeModule === 'analytics' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setActiveModule('analytics')}
            >
              <BarChart2 size={18} />
              <span>Аналитика</span>
            </button>
          </div>

          <div className="pt-4 mt-6 border-t border-gray-700">
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10">
              <LogOut size={18} />
              <span>Выход</span>
            </button>
          </div>

          <div className="mt-6 border-t border-gray-700 pt-6">
            <div className="mb-4">
              <label htmlFor="exchange-select" className="block text-sm text-gray-400 mb-1">Биржа</label>
              <select 
                id="exchange-select" 
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                value={exchange}
                onChange={handleChangeExchange}
              >
                <option value="binance">Binance</option>
                <option value="bybit">Bybit</option>
                <option value="mexc">MEXC</option>
                <option value="bitget">BITGET</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Тип рынка</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  className={`px-4 py-2 rounded-lg text-sm ${marketType === 'spot' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  onClick={() => handleChangeMarketType('spot')}
                >
                  Spot
                </button>
                <button 
                  className={`px-4 py-2 rounded-lg text-sm ${marketType === 'futures' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  onClick={() => handleChangeMarketType('futures')}
                >
                  Futures
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Торговая пара</label>
              <div className="mb-2">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Поиск пары..." 
                    className="w-full bg-gray-700 text-white pl-9 pr-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                    value={pairSearch}
                    onChange={(e) => setPairSearch(e.target.value)}
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </div>
              <div className="flex items-center">
                <select 
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 mr-2"
                  value={currentPair}
                  onChange={handleChangePair}
                >
                  {Array.isArray(filteredPairs) && filteredPairs.length > 0 ? (
                    filteredPairs.map(renderPairOption)
                  ) : (
                    <option value="">Загрузка пар...</option>
                  )}
                </select>
                <button 
                  className={`bg-gray-700 p-2 rounded-lg text-gray-400 hover:text-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => fetchPairs(exchange, marketType)}
                  disabled={isLoading}
                >
                  <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Таймфрейм</label>
              <div className="grid grid-cols-5 gap-1">
                {['1m', '5m', '15m', '1H', '1D'].map(int => (
                  <button 
                    key={int}
                    className={`px-2 py-1 rounded-lg text-sm ${interval === int ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    onClick={() => handleChangeInterval(int)}
                  >
                    {int}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </nav>
        
        {/* Основная область контента */}
        <div className="flex-1 overflow-hidden">
          {renderActiveModule()}
        </div>
      </div>
      
      {/* Статусная строка */}
      <footer className="bg-gray-800 px-6 py-2 text-sm text-gray-400 border-t border-gray-700 flex justify-between">
        <div>Статус: Все системы работают нормально</div>
        <div className="flex items-center space-x-4">
          <div>Последнее обновление: 2 мин назад</div>
          <div>AI-модель: Claude 3.7 Sonnet</div>
        </div>
      </footer>

      {/* Модальное окно настроек */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};

export default TradingPlatform;