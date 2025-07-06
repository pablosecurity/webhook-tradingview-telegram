const axios = require('axios');

const WEBHOOK_URL = 'https://webhook-tradingview-telegram.onrender.com';

async function clearAlertas() {
  try {
    console.log('🗑️ Limpando alertas...');
    const response = await axios.delete(`${WEBHOOK_URL}/alertas`);
    console.log('✅ Alertas limpos:', response.data);
  } catch (error) {
    console.log('❌ Erro ao limpar alertas:', error.response?.data || error.message);
  }
}

async function clearLogs() {
  try {
    console.log('🗑️ Limpando logs...');
    const response = await axios.delete(`${WEBHOOK_URL}/logs`);
    console.log('✅ Logs limpos:', response.data);
  } catch (error) {
    console.log('❌ Erro ao limpar logs:', error.response?.data || error.message);
  }
}

async function clearAll() {
  console.log('🧹 Iniciando limpeza completa...\n');
  
  await clearAlertas();
  console.log('');
  await clearLogs();
  
  console.log('\n✅ Limpeza concluída!');
}

// Executar limpeza
clearAll(); 