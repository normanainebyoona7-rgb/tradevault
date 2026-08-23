const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function testBTC() {
  try {
    console.log('Fetching BTC/USD live price...');
    const result = await yahooFinance.chart('BTC-USD', {
      period1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: '1d'
    });
    
    if (result.quotes && result.quotes.length > 0) {
      const prices = result.quotes.filter(q => q.close !== null).map(q => q.close);
      console.log('SUCCESS! BTC Live price:', prices[prices.length - 1]);
      console.log('All prices:', prices.slice(-5));
    } else {
      console.log('No data returned');
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

testBTC();
