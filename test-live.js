const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function test() {
  try {
    console.log('Fetching EUR/USD live price...');
    const result = await yahooFinance.chart('EURUSD=X', {
      period1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: '1d'
    });
    
    if (result.quotes && result.quotes.length > 0) {
      const prices = result.quotes.filter(q => q.close !== null).map(q => q.close);
      console.log('SUCCESS! Live price:', prices[prices.length - 1]);
    } else {
      console.log('No data returned');
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

test();
