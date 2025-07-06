const axios = require('axios');

const WEBHOOK_URL = 'https://webhook-tradingview-telegram.onrender.com/';
const CHAT_ID = '7688351514';

const testData = {
  chat_id: CHAT_ID,
  text: "🚀 Teste do Webhook\n\n✅ Status: Funcionando\n📊 Plataforma: Render\n⏰ Hora: " + new Date().toLocaleString('pt-BR')
};

async function testWebhook() {
  try {
    console.log('🔄 Enviando teste para o webhook...');
    console.log('📤 Dados:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post(WEBHOOK_URL, testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Sucesso!');
    console.log('📊 Status:', response.status);
    console.log('📄 Resposta:', response.data);
    
  } catch (error) {
    console.log('❌ Erro!');
    console.log('📊 Status:', error.response?.status);
    console.log('📄 Resposta:', error.response?.data);
    console.log('🔍 Erro completo:', error.message);
  }
}

// Teste com dados do TradingView
const tradingViewData = {
  chat_id: CHAT_ID,
  text: "📈 Entrada LONG\nAtivo: BTCUSDT\nPreço Entrada: 62700\nHora: 2025-07-06 13:20:00"
};

async function testTradingViewAlert() {
  try {
    console.log('\n🔄 Testando alerta do TradingView...');
    console.log('📤 Dados:', JSON.stringify(tradingViewData, null, 2));
    
    const response = await axios.post(WEBHOOK_URL, tradingViewData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Sucesso!');
    console.log('📊 Status:', response.status);
    console.log('📄 Resposta:', response.data);
    
  } catch (error) {
    console.log('❌ Erro!');
    console.log('📊 Status:', error.response?.status);
    console.log('📄 Resposta:', error.response?.data);
    console.log('🔍 Erro completo:', error.message);
  }
}

// Executar testes
console.log('🧪 Iniciando testes do webhook...\n');
testWebhook().then(() => {
  setTimeout(() => {
    testTradingViewAlert();
  }, 2000);
}); 