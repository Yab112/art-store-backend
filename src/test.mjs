import fetch from 'node-fetch';

async function testConnection() {
  try {
    const response = await fetch(
      'https://api.telegram.org/bot7658339527:AAEz1aTTlYzSGMAnHfGnw-IMraut-zMohAc/getMe',
      { timeout: 10000 },
    );
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error connecting to Telegram API:', error);
  }
}

testConnection();
