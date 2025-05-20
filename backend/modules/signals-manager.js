// signals-manager.js
// Модуль генерации, хранения (в файле), автоматизации и управления торговыми сигналами по ICT/Smart Money

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class SignalsManager {
  constructor(config = {}) {
    this.config = Object.assign({
      signalsFile: path.join(process.cwd(), 'signals.json'),
      autoSendToAI: true, // если true — сигнал сначала идет на AI-анализ
      autoTradeAfterAI: true, // если true — после AI сигнал отправляется в торговлю
      autoTradeDirect: false // если true — сигнал сразу в торговлю, минуя AI
    }, config);
    this.signals = [];
    this.isLoaded = false;
  }

  // Отправить сигнал в торговлю
  async sendToTrade(signal) {
    //  Здесь должен быть вызов торгового модуля
    if (this.core && this.core.getModule) {
       const autoTrader = this.core.getModule('auto-trader');
      if (autoTrader && autoTrader.executeSignal) {
         await autoTrader.executeSignal(signal);
         signal.status = 'TRADED';
         await this.saveSignals();
       }
     }
   }
 
   // API эндпоинты
   registerApiEndpoints(app) {
     // Получить все сигналы
     app.get('/api/signals', async (req, res) => {
       const { status, source } = req.query;
       const signals = await this.getSignals({ status, source });
       res.json({ success: true, signals });
     });
     // Сгенерировать новый сигнал (POST)
     app.post('/api/signals/generate', async (req, res) => {
       try {
         const signal = await this.generateSignal(req.body);
         res.json({ success: true, signal });
       } catch (e) {
         res.status(500).json({ error: e.message });
       }
     });
     // Отправить сигнал на AI-анализ вручную
     app.post('/api/signals/ai-check/:id', async (req, res) => {
       const signal = this.signals.find(s => s.id === req.params.id);
       if (!signal) return res.status(404).json({ error: 'Signal not found' });
       await this.sendToAI(signal);
       res.json({ success: true, signal });
     });
     // Отправить сигнал в торговлю вручную
     app.post('/api/signals/trade/:id', async (req, res) => {
       const signal = this.signals.find(s => s.id === req.params.id);
       if (!signal) return res.status(404).json({ error: 'Signal not found' });
       await this.sendToTrade(signal);
       res.json({ success: true, signal });
     });
   }
  async initialize() {
    await this.loadSignals();
  }

  async loadSignals() {
    try {
      const content = await fs.readFile(this.config.signalsFile, 'utf-8');
      this.signals = JSON.parse(content);
      this.isLoaded = true;
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.signals = [];
        this.isLoaded = true;
        await this.saveSignals();
      } else {
        throw e;
      }
    }
  }

  async saveSignals() {
    await fs.writeFile(this.config.signalsFile, JSON.stringify(this.signals, null, 2), 'utf-8');
  }

  // Генерация сигнала на основе ICT/Smart Money (реальная логика)
  async generateSignal({ pair, exchange, timeframe }) {
    let decisionLog = [];
    if (!this.core || typeof this.core.getChartData !== 'function') {
      throw new Error('core.getChartData не доступен');
    }
    // 1. Получаем исторические данные
    const chartData = await this.core.getChartData({ symbol: pair, interval: timeframe, limit: 200 });
    if (!chartData || chartData.length < 50) {
      throw new Error('Недостаточно данных для анализа');
    }

    // 2. Находим экстремумы (high/low), зоны консолидации, импульсы
    const highs = chartData.map(c => c.high);
    const lows = chartData.map(c => c.low);
    const closes = chartData.map(c => c.close);
    const opens = chartData.map(c => c.open);
    const lastCandle = chartData[chartData.length - 1];
    const prevCandle = chartData[chartData.length - 2];
    const swingHigh = Math.max(...highs.slice(-20));
    const swingLow = Math.min(...lows.slice(-20));
    const range = swingHigh - swingLow;

    let direction = null;
    let entryPoint = null;
    let stopLoss = null;
    let takeProfit = null;
    let reasoning = '';
    let confidence = 0.7;

    // Диагностика: выводим последние значения high, low, close и их типы
    console.log(`[DEBUG][${pair}] highs.slice(-5):`, highs.slice(-5), 'type:', typeof highs[0]);
    console.log(`[DEBUG][${pair}] lows.slice(-5):`, lows.slice(-5), 'type:', typeof lows[0]);
    console.log(`[DEBUG][${pair}] closes.slice(-5):`, closes.slice(-5), 'type:', typeof closes[0]);
    console.log(`[DEBUG][${pair}] lastCandle:`, lastCandle);
    console.log(`[DEBUG][${pair}] prevCandle:`, prevCandle);
    console.log(`[DEBUG][${pair}] highs.length:`, highs.length, 'lows.length:', lows.length, 'closes.length:', closes.length);

    // ICT BUY
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] ICT BUY: ` + (lastCandle.low < Math.min(...lows.slice(-10, -1)) && lastCandle.close > prevCandle.close && lastCandle.close > lastCandle.open) + '\x1b[0m');
    if (lastCandle.low < Math.min(...lows.slice(-10, -1)) && lastCandle.close > prevCandle.close && lastCandle.close > lastCandle.open) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.1;
      takeProfit = entryPoint + range * 0.8;
      reasoning = 'Обнаружен захват ликвидности (liquidity grab) под минимумами, быстрый возврат выше уровня — паттерн ICT для лонга.';
      confidence = 0.8;
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    // ICT SELL
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] ICT SELL: ` + (lastCandle.high > Math.max(...highs.slice(-10, -1)) && lastCandle.close < prevCandle.close && lastCandle.close < lastCandle.open) + '\x1b[0m');
    if (lastCandle.high > Math.max(...highs.slice(-10, -1)) && lastCandle.close < prevCandle.close && lastCandle.close < lastCandle.open) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.1;
      takeProfit = entryPoint - range * 0.8;
      reasoning = 'Обнаружен захват ликвидности (liquidity grab) над максимумами, быстрый возврат ниже уровня — паттерн ICT для шорта.';
      confidence = 0.8;
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    // HH
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] HH: ` + (highs[highs.length-2] > highs[highs.length-3] && highs[highs.length-1] > highs[highs.length-2]) + '\x1b[0m');
    if (highs[highs.length-2] > highs[highs.length-3] && highs[highs.length-1] > highs[highs.length-2]) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.1;
      takeProfit = entryPoint + range * 0.7;
      reasoning = 'Обнаружен паттерн Higher Highs (HH): последовательный рост максимумов — тренд вверх, потенциальный лонг.';
      confidence = 0.7;
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    // LL
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] LL: ` + (lows[lows.length-2] < lows[lows.length-3] && lows[lows.length-1] < lows[lows.length-2]) + '\x1b[0m');
    if (lows[lows.length-2] < lows[lows.length-3] && lows[lows.length-1] < lows[lows.length-2]) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.1;
      takeProfit = entryPoint - range * 0.7;
      reasoning = 'Обнаружен паттерн Lower Lows (LL): последовательное снижение минимумов — тренд вниз, потенциальный шорт.';
      confidence = 0.7;
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    // HL
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] HL: ` + (closes[closes.length-2] > closes[closes.length-3] && lows[lows.length-1] > lows[lows.length-2]) + '\x1b[0m');
    if (closes[closes.length-2] > closes[closes.length-3] && lows[lows.length-1] > lows[lows.length-2]) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.1;
      takeProfit = entryPoint + range * 0.6;
      reasoning = 'Обнаружен паттерн Higher Low (HL): минимум выше предыдущего, подтверждение бычьего тренда.';
      confidence = 0.65;
      console.log(`[SIGNAL][${pair}] HL сигнал сработал!`, { direction, entryPoint, stopLoss, takeProfit, reasoning, confidence });
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    // LH
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] LH: ` + (closes[closes.length-2] < closes[closes.length-3] && highs[highs.length-1] < highs[highs.length-2]) + '\x1b[0m');
    if (closes[closes.length-2] < closes[closes.length-3] && highs[highs.length-1] < highs[highs.length-2]) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.1;
      takeProfit = entryPoint - range * 0.6;
      reasoning = 'Обнаружен паттерн Lower High (LH): максимум ниже предыдущего, подтверждение медвежьего тренда.';
      confidence = 0.65;
      console.log(`[SIGNAL][${pair}] LH сигнал сработал!`, { direction, entryPoint, stopLoss, takeProfit, reasoning, confidence });
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    // CHoCH SELL
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] CHoCH SELL: ` + (highs[highs.length-2] > highs[highs.length-3] && lows[lows.length-1] < lows[lows.length-2] && closes[closes.length-1] < closes[closes.length-2]) + '\x1b[0m');
    if (highs[highs.length-2] > highs[highs.length-3] && lows[lows.length-1] < lows[lows.length-2] && closes[closes.length-1] < closes[closes.length-2]) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.15;
      takeProfit = entryPoint - range * 0.8;
      reasoning = 'Обнаружен паттерн CHoCH (Change of Character): смена структуры рынка с бычьей на медвежью.';
      confidence = 0.75;
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    // CHoCH BUY
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] CHoCH BUY: ` + (lows[lows.length-2] < lows[lows.length-3] && highs[highs.length-1] > highs[highs.length-2] && closes[closes.length-1] > closes[closes.length-2]) + '\x1b[0m');
    if (lows[lows.length-2] < lows[lows.length-3] && highs[highs.length-1] > highs[highs.length-2] && closes[closes.length-1] > closes[closes.length-2]) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.15;
      takeProfit = entryPoint + range * 0.8;
      reasoning = 'Обнаружен паттерн CHoCH (Change of Character): смена структуры рынка с медвежьей на бычью.';
      confidence = 0.75;
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    // Если ни один паттерн не найден
    return null;
  }
}

SignalsManager.prototype.scanAllPairsAndGenerateSignals = async function({ exchange, timeframe, productType = 'umcbl', limit = 10, autoSendToAI, autoTradeAfterAI, autoTradeDirect }) {
  if (!this.core || typeof this.core.getExchangeConnector !== 'function') {
    throw new Error('core.getExchangeConnector не доступен');
  }
  let pairs = await this.core.getExchangeConnector(exchange).getFuturesTradingPairs(productType);
  pairs = pairs.sort(() => Math.random() - 0.5);
  let generated = 0;
  let stopped = false;
  this._scanSignalsStatus = { running: true, generated: 0, total: pairs.length, stop: () => { stopped = true; this._scanSignalsStatus.running = false; } };
  // временно применяем настройки
  if (typeof autoSendToAI === 'boolean') this.config.autoSendToAI = autoSendToAI;
  if (typeof autoTradeAfterAI === 'boolean') this.config.autoTradeAfterAI = autoTradeAfterAI;
  if (typeof autoTradeDirect === 'boolean') this.config.autoTradeDirect = autoTradeDirect;
  for (let i = 0; i < pairs.length; i++) {
    if (generated >= limit || stopped) break;
    const pairObj = pairs[i];
    try {
      const signal = await this.generateSignal({
        pair: pairObj.symbol || pairObj,
        exchange,
        timeframe
      });
      if (signal) {
        this.signals.push(signal);
        generated++;
        this._scanSignalsStatus.generated = generated;
      }
    } catch (e) {
      console.error(`Ошибка генерации сигнала для пары ${pairObj.symbol || pairObj}:`, e);
      continue;
    }
  }
    // ... остальной код ...
    // (Удалено: старые else if HH, LL, HL, LH)

    
    // CHoCH (Change of Character): смена структуры рынка
    console.log(`\x1b[34m[ПАТТЕРН][${pair}] CHoCH SELL: ` + (highs[highs.length-2] > highs[highs.length-3] && lows[lows.length-1] < lows[lows.length-2] && closes[closes.length-1] < closes[closes.length-2]) + '\x1b[0m');
    if (
      highs[highs.length-2] > highs[highs.length-3] &&
      lows[lows.length-1] < lows[lows.length-2] &&
      closes[closes.length-1] < closes[closes.length-2]
    ) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.15;
      takeProfit = entryPoint - range * 0.8;
      reasoning = 'Обнаружен паттерн CHoCH (Change of Character): смена структуры рынка с бычьей на медвежью.';
      confidence = 0.75;
      if (orderBookWalls && orderBookWalls.length > 0) {
        console.log(`[ORDERBOOK][${pair}] Обнаружены крупные стены:`, orderBookWalls);
        const duplicateSizes = orderBookWalls.filter((w, i, arr) => arr.findIndex(x => x.size === w.size) !== i);
        if (duplicateSizes.length > 0) {
          console.log(`[ORDERBOOK][${pair}] Обнаружены дублирующиеся объёмы стен:`, duplicateSizes.map(w => w.size));
        }
      }
      console.log(`[SIGNAL][${pair}] CHoCH SELL сигнал сработал!`, { direction, entryPoint, stopLoss, takeProfit, reasoning, confidence });
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }

    console.log(`\x1b[34m[ПАТТЕРН][${pair}] CHoCH BUY: ` + (lows[lows.length-2] < lows[lows.length-3] && highs[highs.length-1] > highs[highs.length-2] && closes[closes.length-1] > closes[closes.length-2]) + '\x1b[0m');
    if (
      lows[lows.length-2] < lows[lows.length-3] &&
      highs[highs.length-1] > highs[highs.length-2] &&
      closes[closes.length-1] > closes[closes.length-2]
    ) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.15;
      takeProfit = entryPoint + range * 0.8;
      reasoning = 'Обнаружен паттерн CHoCH (Change of Character): смена структуры рынка с медвежьей на бычью.';
      confidence = 0.75;
      if (orderBookWalls && orderBookWalls.length > 0) {
        console.log(`[ORDERBOOK][${pair}] Обнаружены крупные стены:`, orderBookWalls);
        const duplicateSizes = orderBookWalls.filter((w, i, arr) => arr.findIndex(x => x.size === w.size) !== i);
        if (duplicateSizes.length > 0) {
          console.log(`[ORDERBOOK][${pair}] Обнаружены дублирующиеся объёмы стен:`, duplicateSizes.map(w => w.size));
        }
      }
      console.log(`[SIGNAL][${pair}] CHoCH BUY сигнал сработал!`, { direction, entryPoint, stopLoss, takeProfit, reasoning, confidence });
      return { pair, direction, entryPoint, stopLoss, takeProfit, reasoning, confidence };
    }
    
    // BOS (Break of Structure): пробой ключевого экстремума
    if (
      highs[highs.length-1] > Math.max(...highs.slice(-6, -1))
    ) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.12;
      takeProfit = entryPoint + range * 0.9;
      reasoning = 'Обнаружен паттерн BOS (Break of Structure): пробой ключевого максимума, подтверждение бычьего импульса.';
      confidence = 0.7;
    }  if (
      lows[lows.length-1] < Math.min(...lows.slice(-6, -1))
    ) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.12;
      takeProfit = entryPoint - range * 0.9;
      reasoning = 'Обнаружен паттерн BOS (Break of Structure): пробой ключевого минимума, подтверждение медвежьего импульса.';
      confidence = 0.7;
    }
    // EQH/EQL (Equal Highs/Lows): поиск ликвидности над равными экстремумами
    if (
      Math.abs(highs[highs.length-1] - highs[highs.length-2]) < range * 0.02 &&
      Math.abs(highs[highs.length-2] - highs[highs.length-3]) < range * 0.02
    ) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.1;
      takeProfit = entryPoint - range * 0.7;
      reasoning = 'Обнаружен паттерн Equal Highs (EQH): формирование ликвидности над равными максимумами.';
      confidence = 0.6;
    }  if (
      Math.abs(lows[lows.length-1] - lows[lows.length-2]) < range * 0.02 &&
      Math.abs(lows[lows.length-2] - lows[lows.length-3]) < range * 0.02
    ) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.1;
      takeProfit = entryPoint + range * 0.7;
      reasoning = 'Обнаружен паттерн Equal Lows (EQL): формирование ликвидности под равными минимумами.';
      confidence = 0.6;
    }
    // FVG (Fair Value Gap): разрыв между свечами
    if (
      opens[opens.length-2] > closes[closes.length-3] &&
      opens[opens.length-2] - closes[closes.length-3] > range * 0.2
    ) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.1;
      takeProfit = entryPoint - range * 0.7;
      reasoning = 'Обнаружен паттерн Fair Value Gap (FVG): разрыв между свечами, возможный возврат к справедливой цене.';
      confidence = 0.65;
    } if (
      closes[closes.length-2] < opens[opens.length-3] &&
      opens[opens.length-3] - closes[closes.length-2] > range * 0.2
    ) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.1;
      takeProfit = entryPoint + range * 0.7;
      reasoning = 'Обнаружен паттерн Fair Value Gap (FVG): разрыв между свечами, возможный возврат к справедливой цене.';
      confidence = 0.65;
    }
    // OB (Order Block): крупная свеча против тренда
    if (
      lastCandle.close < lastCandle.open && lastCandle.volume > 1.5 * (chartData.map(c=>c.volume).reduce((a,b)=>a+b,0)/chartData.length)
    ) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.1;
      takeProfit = entryPoint + range * 0.7;
      reasoning = 'Обнаружен паттерн Order Block (OB): крупная медвежья свеча на объёме, возможный разворот.';
      confidence = 0.7;
    } if (
      lastCandle.close > lastCandle.open && lastCandle.volume > 1.5 * (chartData.map(c=>c.volume).reduce((a,b)=>a+b,0)/chartData.length)
    ) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.1;
      takeProfit = entryPoint - range * 0.7;
      reasoning = 'Обнаружен паттерн Order Block (OB): крупная бычья свеча на объёме, возможный разворот.';
      confidence = 0.7;
    }
    // MSB/MSS (Market Structure Break/Shift): резкое изменение направления
    if (
      highs[highs.length-1] > highs[highs.length-2] &&
      lows[lows.length-1] > lows[lows.length-2] &&
      closes[closes.length-1] > closes[closes.length-2]
    ) {
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.1;
      takeProfit = entryPoint + range * 0.7;
      reasoning = 'Обнаружен паттерн MSB/MSS: резкое изменение структуры рынка в бычью сторону.';
      confidence = 0.7;
    } if (
      highs[highs.length-1] < highs[highs.length-2] &&
      lows[lows.length-1] < lows[lows.length-2] &&
      closes[closes.length-1] < closes[closes.length-2]
    ) {
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.1;
      takeProfit = entryPoint - range * 0.7;
      reasoning = 'Обнаружен паттерн MSB/MSS: резкое изменение структуры рынка в медвежью сторону.';
      confidence = 0.7;
    }
    // Stop Hunt (охота за стопами): прокол экстремума и возврат
    if (
      lastCandle.low < Math.min(...lows.slice(-20, -1)) &&
      lastCandle.close > Math.min(...lows.slice(-20, -1)) &&
      lastCandle.close > lastCandle.open
    ) {
      // Определяем зоны скопления стопов ниже (Equal Lows)
      let stopClusters = [];
      for (let i = lows.length - 20; i < lows.length - 2; i++) {
        if (Math.abs(lows[i] - lows[i+1]) < range * 0.01 && Math.abs(lows[i+1] - lows[i+2]) < range * 0.01) {
          stopClusters.push(lows[i]);
        }
      }
      let nearestCluster = Math.min(...stopClusters.filter(lvl => lvl < lastCandle.close));
      direction = 'BUY';
      entryPoint = lastCandle.close;
      stopLoss = swingLow - range * 0.08;
      takeProfit = entryPoint + range * 0.65;
      reasoning = 'Обнаружена охота за стопами (Stop Hunt) под минимумами: прокол лоу и возврат выше экстремума.';
      if (!isNaN(nearestCluster)) {
        reasoning += `\nБлижайший кластер стопов (EQL) был на уровне ${nearestCluster.toFixed(2)}. Цена вероятно пойдет за ликвидностью вниз перед разворотом.`;
      }
      confidence = 0.75;
    } if (
      lastCandle.high > Math.max(...highs.slice(-20, -1)) &&
      lastCandle.close < Math.max(...highs.slice(-20, -1)) &&
      lastCandle.close < lastCandle.open
    ) {
      // Определяем зоны скопления стопов выше (Equal Highs)
      let stopClusters = [];
      for (let i = highs.length - 20; i < highs.length - 2; i++) {
        if (Math.abs(highs[i] - highs[i+1]) < range * 0.01 && Math.abs(highs[i+1] - highs[i+2]) < range * 0.01) {
          stopClusters.push(highs[i]);
        }
      }
      let nearestCluster = Math.max(...stopClusters.filter(lvl => lvl > lastCandle.close));
      direction = 'SELL';
      entryPoint = lastCandle.close;
      stopLoss = swingHigh + range * 0.08;
      takeProfit = entryPoint - range * 0.65;
      reasoning = 'Обнаружена охота за стопами (Stop Hunt) над максимумами: прокол хай и возврат ниже экстремума.';
      if (!isNaN(nearestCluster)) {
        reasoning += `\nБлижайший кластер стопов (EQH) был на уровне ${nearestCluster.toFixed(2)}. Цена вероятно пойдет за ликвидностью вверх перед разворотом.`;
      }
      confidence = 0.75;
    }
    // Дополнительная логика: если есть консолидация и выход из диапазона
    if (Math.abs(lastCandle.close - lastCandle.open) > range * 0.4) {
      if (lastCandle.close > lastCandle.open) {
        direction = 'BUY';
        entryPoint = lastCandle.close;
        stopLoss = swingLow - range * 0.1;
        takeProfit = entryPoint + range * 0.8;
        reasoning = 'Обнаружен импульсный выход вверх из консолидации — паттерн Smart Money (Breakout BUY).';
        confidence = 0.7;
      } else {
        direction = 'SELL';
        entryPoint = lastCandle.close;
        stopLoss = swingHigh + range * 0.1;
        takeProfit = entryPoint - range * 0.8;
        reasoning = 'Обнаружен импульсный выход вниз из консолидации — паттерн Smart Money (Breakout SELL).';
        confidence = 0.7;
      }
    } else {
      throw new Error('Нет подходящего ICT/Smart Money паттерна для сигнала');
    }

    const getOrderBookAnalysis = async (core, pair, entryPoint, direction, decisionLog, reasoning, confidence) => {
      let orderBookWalls = [];
      let orderBookLog = '';
      try {
        if (core && typeof core.getOrderBook === 'function') {
          const orderBook = await core.getOrderBook({ symbol: pair, limit: 50 });
          if (orderBook && orderBook.bids && orderBook.asks) {
            const allLevels = orderBook.bids.concat(orderBook.asks);
            const avgSize = allLevels.reduce((a,b)=>a+b[1],0) / allLevels.length;
            // Стены на покупку
            orderBook.bids.forEach(([price, size]) => {
              if (size > avgSize * 3) {
                orderBookWalls.push({ side: 'buy', price, size });
                orderBookLog += `Buy wall: ${price} (size ${size})\n`;
              }
            });
            // Стены на продажу
            orderBook.asks.forEach(([price, size]) => {
              if (size > avgSize * 3) {
                orderBookWalls.push({ side: 'sell', price, size });
                orderBookLog += `Sell wall: ${price} (size ${size})\n`;
              }
            });
          }
        } else {
          orderBookLog = 'Order book data unavailable (core.getOrderBook not implemented)';
        }
      } catch (e) {
        orderBookLog = `Order book error: ${e.message}`;
      }
      let sizeCounts = {};
      orderBookWalls.forEach(w => {
        sizeCounts[w.size] = (sizeCounts[w.size] || 0) + 1;
      });
      const duplicateSizes = Object.entries(sizeCounts).filter(([size, count]) => count > 1);
      orderBookWalls.forEach(w => {
        w.isDuplicate = sizeCounts[w.size] > 1;
      });
      // --- Логирование и корректировка confidence ---
      if (orderBookWalls.length > 0) {
        decisionLog.push({ step: 'orderBook', info: orderBookLog, walls: orderBookWalls });
        reasoning += `\nOrder book analysis: ${orderBookLog}`;
        if (duplicateSizes.length > 0) {
          decisionLog.push({ step: 'orderBook', info: 'Обнаружены одинаковые объёмы заявок', duplicates: duplicateSizes });
          reasoning += `\nВ стакане обнаружены несколько крупных заявок с одинаковым объёмом: ${duplicateSizes.map(([size])=>size).join(', ')}. Это может указывать на алгоритмические заявки или манипуляцию.`;
        }
        const buyWallsBelow = orderBookWalls.filter(w => w.side==='buy' && w.price < entryPoint);
        const sellWallsAbove = orderBookWalls.filter(w => w.side==='sell' && w.price > entryPoint);
        if (direction==='BUY' && buyWallsBelow.length>0) {
          confidence += 0.05;
          reasoning += '\nBuy wall below entry — сигнал усилен.';
        }
        if (direction==='SELL' && sellWallsAbove.length>0) {
          confidence += 0.05;
          reasoning += '\nSell wall above entry — сигнал усилен.';
        }
        if (direction==='BUY' && sellWallsAbove.length>0) {
          confidence -= 0.05;
          reasoning += '\nSell wall above entry — сигнал ослаблен.';
        }
        if (direction==='SELL' && buyWallsBelow.length>0) {
          confidence -= 0.05;
          reasoning += '\nBuy wall below entry — сигнал ослаблен.';
        }
      } else {
        decisionLog.push({ step: 'orderBook', info: orderBookLog });
        reasoning += `\nOrder book analysis: ${orderBookLog}`;
      }
    }
  }

SignalsManager.prototype.scanAllPairsAndGenerateSignals = async function({ exchange, timeframe, productType = 'umcbl', limit = 10, autoSendToAI, autoTradeAfterAI, autoTradeDirect }) {
  if (!this.core || typeof this.core.getExchangeConnector !== 'function') {
    throw new Error('core.getExchangeConnector не доступен');
  }
  let pairs = await this.core.getExchangeConnector(exchange).getFuturesTradingPairs(productType);
  pairs = pairs.sort(() => Math.random() - 0.5);
  let generated = 0;
  let stopped = false;
  this._scanSignalsStatus = { running: true, generated: 0, total: pairs.length, stop: () => { stopped = true; this._scanSignalsStatus.running = false; } };
  // временно применяем настройки
  if (typeof autoSendToAI === 'boolean') this.config.autoSendToAI = autoSendToAI;
  if (typeof autoTradeAfterAI === 'boolean') this.config.autoTradeAfterAI = autoTradeAfterAI;
  if (typeof autoTradeDirect === 'boolean') this.config.autoTradeDirect = autoTradeDirect;
  for (let i = 0; i < pairs.length; i++) {
    if (generated >= limit || stopped) break;
    const pairObj = pairs[i];
    try {
      // Лог: старт анализа пары
      console.log('\x1b[34m[SCAN] Анализ пары: ' + pairObj.symbol + '\x1b[0m');
      const signal = await this.generateSignal({ pair: pairObj.symbol, exchange, timeframe });
      if (signal) {
        console.log('\x1b[34m[SCAN] Найден сигнал для пары: ' + pairObj.symbol + '\x1b[0m');
        generated++;
        this._scanSignalsStatus.generated = generated;
      } else {
        console.log('\x1b[34m[SCAN] Нет сигнала для пары: ' + pairObj.symbol + '\x1b[0m');
      }
    } catch (e) {
      console.log('\x1b[34m[SCAN] Ошибка при анализе пары ' + pairObj.symbol + ': ' + e.message + '\x1b[0m');
    }
  }
  this._scanSignalsStatus.running = false;
  return generated;
};

// Получить сигналы с фильтрацией по статусу и source
SignalsManager.prototype.getSignals = async function({ status, source } = {}) {
  let result = this.signals || [];
  if (status) {
    result = result.filter(signal => signal.status === status);
  }
  if (source) {
    result = result.filter(signal => signal.source === source);
  }
  return result;
};

SignalsManager.prototype.stopScanSignals = function() {
  if (this._scanSignalsStatus && typeof this._scanSignalsStatus.stop === 'function') {
    this._scanSignalsStatus.stop();
  }
};
SignalsManager.prototype.getScanSignalsStatus = function() {
  return this._scanSignalsStatus || { running: false, generated: 0, total: 0 };
};

module.exports = SignalsManager;