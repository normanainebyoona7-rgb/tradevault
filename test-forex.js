async function testForex() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    console.log('EUR rate:', data.rates.EUR);
    console.log('GBP rate:', data.rates.GBP);
    console.log('JPY rate:', data.rates.JPY);
    console.log('All rates:', Object.keys(data.rates).length);
  } catch (error) {
    console.error('Forex API failed:', error.message);
  }
}

testForex();
