import React from 'react';

const DashboardContent = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Дашборд</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика портфеля</h2>
          <div className="bg-gray-750 p-4 rounded-lg mb-4">
            <div className="text-sm text-gray-400">Общий баланс</div>
            <div className="text-2xl font-bold">$10,245.78</div>
            <div className="text-sm text-green-400">+$245.32 (2.45%)</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-750 p-3 rounded-lg">
              <div className="text-sm text-gray-400">Открытые позиции</div>
              <div className="text-lg font-medium">3</div>
            </div>
            <div className="bg-gray-750 p-3 rounded-lg">
              <div className="text-sm text-gray-400">Активные сетки</div>
              <div className="text-lg font-medium">2</div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Торговая статистика</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-750 p-3 rounded-lg">
              <div className="text-sm text-gray-400">Win Rate</div>
              <div className="text-lg font-medium">68%</div>
            </div>
            <div className="bg-gray-750 p-3 rounded-lg">
              <div className="text-sm text-gray-400">Profit Factor</div>
              <div className="text-lg font-medium">2.4</div>
            </div>
            <div className="bg-gray-750 p-3 rounded-lg">
              <div className="text-sm text-gray-400">Сделок (30д)</div>
              <div className="text-lg font-medium">42</div>
            </div>
            <div className="bg-gray-750 p-3 rounded-lg">
              <div className="text-sm text-gray-400">ROI (30д)</div>
              <div className="text-lg font-medium text-green-400">+12.8%</div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Новые сигналы</h2>
          <div className="space-y-3">
            <div className="bg-gray-750 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">BTC/USDT</span>
                <span className="bg-green-500/30 text-green-400 text-xs px-2 py-1 rounded">LONG</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>AI: 89%</span>
                <span>5 мин назад</span>
              </div>
            </div>
            
            <div className="bg-gray-750 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">ETH/USDT</span>
                <span className="bg-red-500/30 text-red-400 text-xs px-2 py-1 rounded">SHORT</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>AI: 76%</span>
                <span>12 мин назад</span>
              </div>
            </div>
            
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm mt-2">
              Все сигналы
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Текущие позиции</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-750">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Пара</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Тип</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Вход</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Текущая цена</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Прибыль</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              <tr className="hover:bg-gray-750">
                <td className="py-2 px-3 font-medium">BTC/USDT</td>
                <td className="py-2 px-3">
                  <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">LONG</span>
                </td>
                <td className="py-2 px-3">$42,500</td>
                <td className="py-2 px-3">$43,100</td>
                <td className="py-2 px-3 text-green-400">+$140 (6.59%)</td>
                <td className="py-2 px-3 text-xs text-gray-400">5 часов назад</td>
              </tr>
              <tr className="hover:bg-gray-750">
                <td className="py-2 px-3 font-medium">ETH/USDT</td>
                <td className="py-2 px-3">
                  <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">SHORT</span>
                </td>
                <td className="py-2 px-3">$2,900</td>
                <td className="py-2 px-3">$2,850</td>
                <td className="py-2 px-3 text-green-400">+$37.50 (8.62%)</td>
                <td className="py-2 px-3 text-xs text-gray-400">12 часов назад</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardContent;