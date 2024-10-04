require('dotenv').config();

const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.json());

//use your own API Key
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Constants for strategies
const BUY_THRESHOLD = -0.02;  // 2% drop
const SELL_THRESHOLD = 0.03;  // 3% rise

async function fetchMarketData() {
    try {
        const response = await axios.get('https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&outputsize=full&apikey=demo');
        const timeSeries = response.data['Time Series (5min)'];
        
        return Object.entries(timeSeries).map(([timestamp, values]) => ({
            date: timestamp,
            price: parseFloat(values['4. close'])
        })).reverse();
    } catch (error) {
        console.error('Error fetching market data:', error);
        return null;
    }
}

function movingAverageCrossoverStrategy(data, shortWindow = 12, longWindow = 26) {
    function calculateMA(data, window) {
        return data.map((_, index, array) => {
            if (index < window - 1) return null;
            const slice = array.slice(index - window + 1, index + 1);
            const sum = slice.reduce((acc, val) => acc + val.price, 0);
            return sum / window;
        });
    }

    const shortMA = calculateMA(data, shortWindow);
    const longMA = calculateMA(data, longWindow);
    
    return data.map((item, index) => ({
        ...item,
        shortMA: shortMA[index],
        longMA: longMA[index],
        maSignal: index >= longWindow - 1 ? 
            (shortMA[index] > longMA[index] ? 1 : -1) : 0
    }));
}

function momentumStrategy(data, lookbackPeriod = 20) {
    return data.map((item, index) => ({
        ...item,
        momentum: index >= lookbackPeriod ?
            (item.price - data[index - lookbackPeriod].price > 0 ? 1 : -1) : 0
    }));
}

function thresholdStrategy(data) {
    let lastBuyPrice = null;
    return data.map((item, index) => {
        let signal = 0;
        
        if (index > 0) {
            const priceChange = (item.price - data[index - 1].price) / data[index - 1].price;
            
            if (priceChange <= BUY_THRESHOLD && !lastBuyPrice) {
                signal = 1;
                lastBuyPrice = item.price;
            } else if (lastBuyPrice && (item.price - lastBuyPrice) / lastBuyPrice >= SELL_THRESHOLD) {
                signal = -1;
                lastBuyPrice = null;
            }
        }
        
        return { ...item, thresholdSignal: signal };
    });
}

function calculateStrategyReturns(data, strategyKey) {
    let returns = [];
    let position = 0;
    let lastTradePrice = null;
    let totalReturn = 0;
    let trades = [];

    data.forEach((item, index) => {
        if (index === 0) return;

        const signal = item[strategyKey];
        if (signal !== 0 && signal !== position) {
            if (signal === 1) { // Buy signal
                lastTradePrice = item.price;
                trades.push({
                    date: item.date,
                    type: 'BUY',
                    price: item.price
                });
            } else if (signal === -1 && lastTradePrice) { // Sell signal
                const tradeReturn = (item.price - lastTradePrice) / lastTradePrice;
                totalReturn += tradeReturn;
                trades.push({
                    date: item.date,
                    type: 'SELL',
                    price: item.price,
                    return: tradeReturn * 100
                });
                lastTradePrice = null;
            }
            position = signal;
        }
        
        returns.push({
            date: item.date,
            return: totalReturn * 100 // Convert to percentage
        });
    });

    return {
        returns,
        trades,
        finalReturn: totalReturn * 100
    };
}

async function runStrategies() {
    const marketData = await fetchMarketData();
    if (!marketData) return null;
    
    let results = movingAverageCrossoverStrategy(marketData);
    results = momentumStrategy(results);
    results = thresholdStrategy(results);
    
    const maResults = calculateStrategyReturns(results, 'maSignal');
    const momentumResults = calculateStrategyReturns(results, 'momentum');
    const thresholdResults = calculateStrategyReturns(results, 'thresholdSignal');
    
    const initialPrice = marketData[0].price;
    const finalPrice = marketData[marketData.length - 1].price;
    const marketReturn = ((finalPrice - initialPrice) / initialPrice) * 100;

    return {
        marketPerformance: {
            initialPrice,
            finalPrice,
            marketReturn,
            dataPoints: marketData.length
        },
        strategies: {
            movingAverage: {
                finalReturn: maResults.finalReturn,
                trades: maResults.trades
            },
            momentum: {
                finalReturn: momentumResults.finalReturn,
                trades: momentumResults.trades
            },
            threshold: {
                finalReturn: thresholdResults.finalReturn,
                trades: thresholdResults.trades
            }
        }
    };
}

app.get('/run-strategies', async (req, res) => {
    const results = await runStrategies();
    if (!results) {
        return res.status(500).json({ error: 'Failed to fetch market data' });
    }
    
    res.json({
        marketPerformance: results.marketPerformance,
        strategyPerformance: {
            movingAverage: {
                return: results.strategies.movingAverage.finalReturn.toFixed(2) + '%',
                numberOfTrades: results.strategies.movingAverage.trades.length,
                recentTrades: results.strategies.movingAverage.trades.slice(-3)
            },
            momentum: {
                return: results.strategies.momentum.finalReturn.toFixed(2) + '%',
                numberOfTrades: results.strategies.momentum.trades.length,
                recentTrades: results.strategies.momentum.trades.slice(-3)
            },
            threshold: {
                return: results.strategies.threshold.finalReturn.toFixed(2) + '%',
                numberOfTrades: results.strategies.threshold.trades.length,
                recentTrades: results.strategies.threshold.trades.slice(-3)
            }
        }
    });
});

app.listen(port, () => {
    console.log(`Trading bot server running on port ${port}`);
});