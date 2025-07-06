const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.text({ type: "*/*" })); // aceita JSON ou texto puro

const TELEGRAM_BOT_TOKEN = "7967775347:AAEGmdVgEvksdPnz2195rNKNgdjb_PkhMYA";

// Sistema de logs
const LOG_FILE = 'webhook-logs.json';
let logs = [];

// Função para adicionar log
function adicionarLog(tipo, mensagem, dados = null) {
  const log = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    tipo: tipo, // 'webhook_recebido', 'json_parse', 'telegram_envio', 'erro'
    mensagem: mensagem,
    dados: dados
  };
  
  logs.push(log);
  
  // Manter apenas os últimos 1000 logs
  if (logs.length > 1000) {
    logs = logs.slice(-1000);
  }
  
  // Salvar logs no arquivo
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('❌ Erro ao salvar logs:', error.message);
  }
  
  // Log no console também
  console.log(`[${log.timestamp}] ${tipo.toUpperCase()}: ${mensagem}`);
}

// Carregar logs existentes
function carregarLogs() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const data = fs.readFileSync(LOG_FILE, 'utf8');
      logs = JSON.parse(data);
      console.log(`📂 Carregados ${logs.length} logs do arquivo`);
    }
  } catch (error) {
    console.error('❌ Erro ao carregar logs:', error.message);
    logs = [];
  }
}

// Carregar logs ao iniciar
carregarLogs();

// Configurações para salvar alertas
const ALERTAS_FILE = 'alertas.json';
const MAX_ALERTAS = 100; // Máximo de alertas para armazenar

// Array para armazenar os últimos alertas
let alertasRecebidos = [];

// Função para carregar alertas do arquivo
function carregarAlertas() {
  try {
    if (fs.existsSync(ALERTAS_FILE)) {
      const data = fs.readFileSync(ALERTAS_FILE, 'utf8');
      alertasRecebidos = JSON.parse(data);
      console.log(`📂 Carregados ${alertasRecebidos.length} alertas do arquivo`);
    }
  } catch (error) {
    console.error('❌ Erro ao carregar alertas:', error.message);
    alertasRecebidos = [];
  }
}

// Função para salvar alertas no arquivo
function salvarAlertas() {
  try {
    fs.writeFileSync(ALERTAS_FILE, JSON.stringify(alertasRecebidos, null, 2));
    console.log(`💾 Alertas salvos no arquivo (${alertasRecebidos.length} total)`);
  } catch (error) {
    console.error('❌ Erro ao salvar alertas:', error.message);
  }
}

// Carrega alertas ao iniciar
carregarAlertas();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Webhook TradingView -> Telegram está funcionando!',
    total_alertas: alertasRecebidos.length
  });
});

// Endpoint para visualizar alertas recebidos
app.get('/alertas', (req, res) => {
  res.json({
    total: alertasRecebidos.length,
    alertas: alertasRecebidos.slice().reverse() // Mais recentes primeiro (copia para não alterar o original)
  });
});

// Endpoint para limpar alertas antigos
app.delete('/alertas', (req, res) => {
  const quantidade = alertasRecebidos.length;
  alertasRecebidos = [];
  salvarAlertas();
  res.json({
    message: `Alertas limpos com sucesso`,
    removidos: quantidade
  });
});

// Endpoint para visualizar logs
app.get('/logs', (req, res) => {
  const { tipo, limit = 50 } = req.query;
  
  let logsFiltrados = logs;
  
  // Filtrar por tipo se especificado
  if (tipo) {
    logsFiltrados = logs.filter(log => log.tipo === tipo);
  }
  
  // Limitar quantidade
  logsFiltrados = logsFiltrados.slice(-parseInt(limit));
  
  res.json({
    total: logs.length,
    filtrados: logsFiltrados.length,
    logs: logsFiltrados.reverse() // Mais recentes primeiro
  });
});

// Endpoint para limpar logs
app.delete('/logs', (req, res) => {
  const quantidade = logs.length;
  logs = [];
  
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    res.json({
      message: `Logs limpos com sucesso`,
      removidos: quantidade
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao limpar logs',
      details: error.message
    });
  }
});

const CHAT_ID_PADRAO = "7688351514";

app.post(["/", "/webhook"], async (req, res) => {
  let chat_id = req.query.chat_id || CHAT_ID_PADRAO;
  let text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  adicionarLog('webhook_recebido', 'Mensagem recebida para envio', {
    chat_id,
    textLength: text.length,
    ip: req.ip || req.connection.remoteAddress
  });

  // Salva alerta (sempre salva o texto original recebido)
  const alerta = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    chat_id,
    text,
    original: text,
    ip: req.ip || req.connection.remoteAddress
  };
  alertasRecebidos.push(alerta);
  if (alertasRecebidos.length > MAX_ALERTAS) {
    alertasRecebidos = alertasRecebidos.slice(-MAX_ALERTAS);
  }
  salvarAlertas();

  // Envia para o Telegram
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    adicionarLog('telegram_envio', 'Enviando mensagem para Telegram', { chat_id, textLength: text.length });
    const response = await axios.post(url, { chat_id, text, parse_mode: "Markdown" });
    adicionarLog('telegram_sucesso', 'Mensagem enviada com sucesso', { messageId: response.data?.result?.message_id, chatId: response.data?.result?.chat?.id });
    res.send("Mensagem enviada com sucesso");
  } catch (error) {
    adicionarLog('erro', 'Erro ao enviar para o Telegram', { error: error.message, telegramError: error.response?.data });
    res.status(500).send("Erro ao enviar para o Telegram");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
