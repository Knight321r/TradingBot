# Trading Bot Documentation

## Overview
This trading bot implements multiple trading strategies using Alpha Vantage market data. It analyzes stock price movements and simulates trades based on different technical indicators.

## Setup

### Prerequisites
- Node.js installed
- npm (Node Package Manager)

### API Key
1. Visit [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Get a free API key by providing your name and email

### Installation
1. Clone the repository
2. Create a `.env` file in the project root:
   
   ALPHA_VANTAGE_API_KEY=your_api_key_here

3. Install dependencies:
   npm install express axios dotenv
   ```

### Running the Application
```bash
node tradingbot.js
```
The server will start on port 3000.

## API Endpoints

### GET /run-strategies
Runs all trading strategies and returns performance metrics.

Example response:
```json
{
  "marketPerformance": {
    "initialPrice": 142.50,
    "finalPrice": 143.20,
    "marketReturn": 0.49,
    "dataPoints": 100
  },
  "strategyPerformance": {
    "movingAverage": {
      "return": "0.75%",
      "numberOfTrades": 8,
      "recentTrades": [
        {
          "date": "2024-01-19 15:25:00",
          "type": "BUY",
          "price": 142.65
        }
      ]
    },
    "momentum": {
      "return": "0.60%",
      "numberOfTrades": 6,
      "recentTrades": [...]
    },
    "threshold": {
      "return": "0.90%",
      "numberOfTrades": 4,
      "recentTrades": [...]
    }
  }
}
```

## Trading Strategies

1. **Moving Average Crossover**
   - Uses short-term (12 periods) and long-term (26 periods) moving averages
   - Generates buy signal when short MA crosses above long MA
   - Generates sell signal when short MA crosses below long MA

2. **Momentum**
   - Looks back 20 periods to determine price momentum
   - Buys when current price is higher than 20 periods ago
   - Sells when current price is lower than 20 periods ago

3. **Threshold**
   - Buys when price drops by 2%
   - Sells when price rises by 3% from the buy price

## Output Explanation

- `marketPerformance`: Overall market statistics
  - `initialPrice`: Starting price of the stock
  - `finalPrice`: Ending price of the stock
  - `marketReturn`: Percentage return of buy-and-hold strategy
  - `dataPoints`: Number of price points analyzed

- `strategyPerformance`: Results for each strategy
  - `return`: Percentage return of the strategy
  - `numberOfTrades`: Total number of trades executed
  - `recentTrades`: Last few trades with timestamp and price
