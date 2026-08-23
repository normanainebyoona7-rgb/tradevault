async function testBinance() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const data = await response.json();
    console.log('Binance BTC price:', data.price);
  } catch (error) {
    console.error('Binance failed:', error.message);
  }
}

testBinance();
