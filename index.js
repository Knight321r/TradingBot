const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.json());

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
    
    return data.map((item, index) => {
        let signal = 0;
        if (index >= longWindow - 1) {
            signal = shortMA[index] > longMA[index] ? 1 : -1;
        }
        return {
            ...item,
            shortMA: shortMA[index],
            longMA: longMA[index],
            maSignal: signal  // Renamed to maSignal for clarity
        };
    });
}

function momentumStrategy(data, lookbackPeriod = 20) {
    return data.map((item, index) => {
        let momentumSignal = 0;
        
        if (index >= lookbackPeriod) {
            const priceChange = item.price - data[index - lookbackPeriod].price;
            momentumSignal = priceChange > 0 ? 1 : -1;
        }
        
        return {
            ...item,
            momentum: momentumSignal
        };
    });
}

function calculateReturns(data) {
    let maPosition = 0, momentumPosition = 0;
    let maTotalReturn = 0, momentumTotalReturn = 0;
    let maTrades = [], momentumTrades = [];
    
    return data.map((item, index) => {
        let maReturn = 0, momentumReturn = 0;
        
        if (index > 0) {
            const priceReturn = (item.price - data[index - 1].price) / data[index - 1].price;
            
            // MA Strategy returns
            maReturn = maPosition * priceReturn;
            maTotalReturn += maReturn;
            
            // Momentum Strategy returns
            momentumReturn = momentumPosition * priceReturn;
            momentumTotalReturn += momentumReturn;
            
            // Record trades
            if (maPosition !== item.maSignal && item.maSignal !== 0) {
                maTrades.push({
                    date: item.date,
                    type: item.maSignal === 1 ? 'BUY' : 'SELL',
                    price: item.price,
                    strategy: 'MA Crossover'
                });
            }
            
            if (momentumPosition !== item.momentum && item.momentum !== 0) {
                momentumTrades.push({
                    date: item.date,
                    type: item.momentum === 1 ? 'BUY' : 'SELL',
                    price: item.price,
                    strategy: 'Momentum'
                });
            }
        }
        
        maPosition = item.maSignal;
        momentumPosition = item.momentum;
        
        return {
            ...item,
            maReturn,
            maTotalReturn,
            momentumReturn,
            momentumTotalReturn
        };
    });
}

app.get('/run-strategies', async (req, res) => {
    const marketData = await fetchMarketData();
    if (!marketData) {
        return res.status(500).json({ error: 'Failed to fetch market data' });
    }
    
    // Apply both strategies
    let results = movingAverageCrossoverStrategy(marketData);
    results = momentumStrategy(results);
    
    // Calculate returns for both strategies
    const returnsData = calculateReturns(results);
    
    // Calculate summary statistics
    const lastData = returnsData[returnsData.length - 1];
    const maTrades = returnsData.filter((d, i) => 
        i > 0 && d.maSignal !== returnsData[i-1].maSignal && d.maSignal !== 0
    );
    const momentumTrades = returnsData.filter((d, i) => 
        i > 0 && d.momentum !== returnsData[i-1].momentum && d.momentum !== 0
    );
    
    // Prepare sample data
    const sampleData = returnsData.slice(0, 5).concat(returnsData.slice(-5));
    
    res.json({
        summary: {
            maStrategy: {
                totalReturn: lastData.maTotalReturn * 100,
                numberOfTrades: maTrades.length
            },
            momentumStrategy: {
                totalReturn: lastData.momentumTotalReturn * 100,
                numberOfTrades: momentumTrades.length
            },
            marketData: {
                firstPrice: marketData[0].price,
                lastPrice: marketData[marketData.length - 1].price,
                percentChange: ((marketData[marketData.length - 1].price - marketData[0].price) / marketData[0].price) * 100,
                dataPoints: marketData.length
            }
        },
        sampleData,
        trades: {
            ma: maTrades.slice(0, 5),
            momentum: momentumTrades.slice(0, 5)
        }
    });
});

app.listen(port, () => {
    console.log(`Trading bot server running on port ${port}`);
});