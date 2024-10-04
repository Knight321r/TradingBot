const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.json());

async function fetchMarketData() {
    try {
        const response = await axios.get('https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&outputsize=full&apikey=demo');
        const timeSeries = response.data['Time Series (5min)'];
        
        // Convert API data to our format
        return Object.entries(timeSeries).map(([timestamp, values]) => ({
            date: timestamp,
            price: parseFloat(values['4. close'])
        })).reverse(); // Reverse to get chronological order
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
    
    return data.map((item, index) => {
        let signal = 0;
        if (index >= longWindow - 1) {
            signal = shortMA[index] > longMA[index] ? 1 : -1;
        }
        return {
            ...item,
            shortMA: shortMA[index],
            longMA: longMA[index],
            signal
        };
    });
}

function calculateReturns(data) {
    let position = 0;
    let totalReturn = 0;
    let trades = [];
    
    return data.map((item, index) => {
        let strategyReturn = 0;
        
        if (index > 0) {
            const priceReturn = (item.price - data[index - 1].price) / data[index - 1].price;
            strategyReturn = position * priceReturn;
            totalReturn += strategyReturn;
            
            // Record trade if position changes
            if (position !== item.signal && item.signal !== 0) {
                trades.push({
                    date: item.date,
                    type: item.signal === 1 ? 'BUY' : 'SELL',
                    price: item.price
                });
            }
        }
        
        position = item.signal;
        
        return {
            ...item,
            strategyReturn,
            totalReturn
        };
    });
}

app.get('/run-strategy', async (req, res) => {
    const marketData = await fetchMarketData();
    if (!marketData) {
        return res.status(500).json({ error: 'Failed to fetch market data' });
    }
    
    const strategyResults = movingAverageCrossoverStrategy(marketData);
    const returnsData = calculateReturns(strategyResults);
    
    // Calculate summary statistics
    const finalReturn = returnsData[returnsData.length - 1].totalReturn;
    const trades = returnsData.filter((d, i) => 
        i > 0 && d.signal !== returnsData[i-1].signal && d.signal !== 0
    );
    
    // Sample results for demonstration
    const sampleData = returnsData.slice(0, 5).concat(returnsData.slice(-5));
    
    res.json({
        summary: {
            totalReturn: finalReturn * 100,
            numberOfTrades: trades.length,
            firstPrice: marketData[0].price,
            lastPrice: marketData[marketData.length - 1].price,
            dataPoints: marketData.length
        },
        sampleData,
        trades: trades.slice(0, 5) // First 5 trades
    });
});

app.listen(port, () => {
    console.log(`Trading bot server running on port ${port}`);
});