import React, { useState } from 'react';

const DEFAULT_PATTERNS = [
  { key: 'HH', label: 'Higher Highs (HH)' },
  { key: 'LL', label: 'Lower Lows (LL)' },
  { key: 'HL', label: 'Higher Low (HL)' },
  { key: 'LH', label: 'Lower High (LH)' },
  { key: 'CHoCH_BUY', label: 'CHoCH (Buy)' },
  { key: 'CHoCH_SELL', label: 'CHoCH (Sell)' },
  { key: 'BOS_BUY', label: 'BOS (Buy)' },
  { key: 'BOS_SELL', label: 'BOS (Sell)' },
  { key: 'EQH', label: 'Equal Highs (EQH)' },
  { key: 'EQL', label: 'Equal Lows (EQL)' },
];

export default function SignalSettingsModal({ open, onClose, onSave, initialSettings }) {
  const [exchange, setExchange] = useState(initialSettings.exchange || 'bitget');
  const [marketType, setMarketType] = useState(initialSettings.marketType || 'futures');
  const [timeframe, setTimeframe] = useState(initialSettings.timeframe || '1h');
  const [productType, setProductType] = useState(initialSettings.productType || 'umcbl');
  const [limit, setLimit] = useState(initialSettings.limit || 10);
  const [autoSendToAI, setAutoSendToAI] = useState(initialSettings.autoSendToAI ?? true);
  const [autoTradeDirect, setAutoTradeDirect] = useState(initialSettings.autoTradeDirect ?? false);
  const [patterns, setPatterns] = useState(initialSettings.patterns || DEFAULT_PATTERNS.map(p => p.key));

  const handlePatternToggle = (key) => {
    setPatterns(patterns.includes(key)
      ? patterns.filter(k => k !== key)
      : [...patterns, key]
    );
  };

  const handleSave = () => {
    onSave({ exchange, marketType, timeframe, productType, limit, autoSendToAI, autoTradeDirect, patterns });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-xl relative">
        <button className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={onClose}>
          ✕
        </button>
        <h2 className="text-xl font-bold mb-4">Настройки поиска сигналов</h2>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Биржа</label>
            <select value={exchange} onChange={e => setExchange(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg p-2">
              <option value="bitget">Bitget</option>
              <option value="binance">Binance</option>
              <option value="bybit">Bybit</option>
              <option value="mexc">MEXC</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Тип рынка</label>
            <select value={marketType} onChange={e => setMarketType(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg p-2">
              <option value="futures">Фьючерсы</option>
              <option value="spot">Спот</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Таймфрейм</label>
            <input value={timeframe} onChange={e => setTimeframe(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Product Type</label>
            <input value={productType} onChange={e => setProductType(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Лимит пар</label>
            <input type="number" min={1} value={limit} onChange={e => setLimit(Number(e.target.value))} className="w-full bg-gray-800 text-white rounded-lg p-2" />
          </div>
          <div className="flex flex-col justify-center">
            <label className="flex items-center space-x-2 mb-2">
              <input type="checkbox" checked={autoSendToAI} onChange={e => setAutoSendToAI(e.target.checked)} />
              <span className="text-gray-400 text-sm">Автоотправка в AI</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={autoTradeDirect} onChange={e => setAutoTradeDirect(e.target.checked)} />
              <span className="text-gray-400 text-sm">Автоторговля</span>
            </label>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-1">Паттерны для поиска:</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_PATTERNS.map(pat => (
              <label key={pat.key} className={`flex items-center px-3 py-1 rounded-lg cursor-pointer ${patterns.includes(pat.key) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                <input
                  type="checkbox"
                  checked={patterns.includes(pat.key)}
                  onChange={() => handlePatternToggle(pat.key)}
                  className="mr-2"
                />
                {pat.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg" onClick={onClose}>Отмена</button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg" onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
