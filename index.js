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

app.post("/", async (req, res) => {
  // Log 1: Webhook recebido
  adicionarLog('webhook_recebido', 'Webhook POST recebido', {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type')
  });

  let payload = req.body;

  // Log bruto da requisição recebida
  console.log("📦 Body recebido:", payload);

  // Se for string (como vem do TradingView), tenta converter
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
      // Log 2: JSON parseado com sucesso
      adicionarLog('json_parse', 'JSON parseado com sucesso', {
        originalLength: req.body.length,
        parsedKeys: Object.keys(payload)
      });
    } catch (err) {
      // Log 3: Erro no parse do JSON
      adicionarLog('erro', 'Erro ao fazer parse do JSON', {
        error: err.message,
        body: req.body
      });
      console.error("❌ Erro ao fazer parse do JSON:", err.message);
      return res.status(400).send("Erro ao parsear JSON");
    }
  } else {
    // Log 2: Payload já era objeto
    adicionarLog('json_parse', 'Payload já era objeto JSON', {
      keys: Object.keys(payload)
    });
  }

  const { chat_id, text } = payload;

  // Verifica se os campos obrigatórios existem
  if (!chat_id || !text) {
    // Log 4: Campos obrigatórios ausentes
    adicionarLog('erro', 'Campos obrigatórios ausentes', {
      chat_id: !!chat_id,
      text: !!text,
      payload: payload
    });
    console.warn("⚠️ chat_id ou text ausentes");
    return res.status(400).send("chat_id e text obrigatórios");
  }

  // Log 5: Validação bem-sucedida
  adicionarLog('validacao', 'Campos obrigatórios validados', {
    chat_id: chat_id,
    textLength: text.length
  });

  // Salva o alerta recebido
  const alerta = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    chat_id,
    text,
    ip: req.ip || req.connection.remoteAddress
  };

  // Adiciona o alerta ao array
  alertasRecebidos.push(alerta);

  // Remove alertas antigos se exceder o limite
  if (alertasRecebidos.length > MAX_ALERTAS) {
    alertasRecebidos = alertasRecebidos.slice(-MAX_ALERTAS);
  }

  // Salva no arquivo
  salvarAlertas();

  console.log("📝 Alerta salvo:", alerta);

  // Envia para o Telegram
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    // Log 6: Iniciando envio ao Telegram
    adicionarLog('telegram_envio', 'Iniciando envio ao Telegram', {
      chat_id: chat_id,
      textLength: text.length
    });

    const response = await axios.post(url, {
      chat_id,
      text,
      parse_mode: "Markdown"
    });

    // Log 7: Envio bem-sucedido
    adicionarLog('telegram_sucesso', 'Mensagem enviada com sucesso', {
      messageId: response.data?.result?.message_id,
      chatId: response.data?.result?.chat?.id,
      telegramResponse: response.data
    });

    console.log("✅ Mensagem enviada com sucesso:", response.data);
    res.send("Mensagem enviada com sucesso");
  } catch (error) {
    // Log 8: Erro no envio ao Telegram
    adicionarLog('erro', 'Erro ao enviar para o Telegram', {
      error: error.message,
      telegramError: error.response?.data,
      statusCode: error.response?.status
    });

    console.error("❌ Erro ao enviar para o Telegram:", error.response?.data || error.message);
    res.status(500).send("Erro ao enviar para o Telegram");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
