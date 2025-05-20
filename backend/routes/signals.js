// API endpoints for manual signal scan start/stop/status
const express = require('express');
const router = express.Router();

module.exports = (core, signalsManager) => {
  // Start scan
  router.post('/scan/start', async (req, res) => {
    try {
      const { exchange, timeframe, productType, limit, autoSendToAI, autoTradeAfterAI, autoTradeDirect } = req.body;
      const generated = await signalsManager.scanAllPairsAndGenerateSignals({
        exchange,
        timeframe,
        productType,
        limit,
        autoSendToAI,
        autoTradeAfterAI,
        autoTradeDirect
      });
      res.json({ success: true, generated });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  // Stop scan
  router.post('/scan/stop', (req, res) => {
    signalsManager.stopScanSignals();
    res.json({ success: true });
  });
  // Scan status
  router.get('/scan/status', (req, res) => {
    const status = signalsManager.getScanSignalsStatus();
    res.json({ success: true, status });
  });
  return router;
};
