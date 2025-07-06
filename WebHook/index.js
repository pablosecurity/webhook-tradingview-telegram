const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.text({ type: "*/*" })); // aceita JSON ou texto puro

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = "7967775347:AAEGmdVgEvksdPnz2195rNKNgdjb_PkhMYA";

// Sistema de logs
const LOG_FILE = 'webhook-logs.json';
let logs = [];

// Função para adicionar log
function adicionarLog(tipo, mensagem, dados = null) {
  const log = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    tipo: tipo,
    mensagem: mensagem,
    dados: dados
  };
  
  logs.push(log);
  
  if (logs.length > 1000) {
    logs = logs.slice(-1000);
  }
  
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('❌ Erro ao salvar logs:', error.message);
  }
  
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

carregarLogs();

// Configurações para salvar alertas
const ALERTAS_FILE = 'alertas.json';
const MAX_ALERTAS = 100;

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

carregarAlertas();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Webhook TradingView -> Telegram está funcionando!',
    total_alertas: alertasRecebidos.length,
    total_logs: logs.length
  });
});

// Endpoint para visualizar alertas recebidos
app.get('/alertas', (req, res) => {
  res.json({
    total: alertasRecebidos.length,
    alertas: alertasRecebidos.slice().reverse()
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
  
  if (tipo) {
    logsFiltrados = logs.filter(log => log.tipo === tipo);
  }
  
  logsFiltrados = logsFiltrados.slice(-parseInt(limit));
  
  res.json({
    total: logs.length,
    filtrados: logsFiltrados.length,
    logs: logsFiltrados.reverse()
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

// Função para limpar JSON problemático
function limparJSON(jsonString) {
  // Remove caracteres de controle inválidos
  return jsonString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

app.post("/", async (req, res) => {
  adicionarLog('webhook_recebido', 'Webhook POST recebido', {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type')
  });

  let payload = req.body;
  console.log("📦 Body recebido:", payload);

  if (typeof payload === "string") {
    try {
      // Limpa o JSON antes de fazer parse
      const jsonLimpo = limparJSON(payload);
      payload = JSON.parse(jsonLimpo);
      
      adicionarLog('json_parse', 'JSON parseado com sucesso', {
        originalLength: req.body.length,
        parsedKeys: Object.keys(payload)
      });
    } catch (err) {
      // Tenta extrair informações mesmo com JSON inválido
      adicionarLog('erro', 'Erro ao fazer parse do JSON, tentando extrair dados', {
        error: err.message,
        body: req.body
      });
      
      // Tenta extrair chat_id e text mesmo com JSON inválido
      console.log("🔍 Tentando extrair dados do JSON inválido...");
      
      // Regex mais robusto para extrair dados
      const chatIdMatch = req.body.match(/"chat_id"\s*:\s*"([^"]+)"/);
      const textMatch = req.body.match(/"text"\s*:\s*"([^"]+)"/);
      
      console.log("🔍 Chat ID match:", chatIdMatch);
      console.log("🔍 Text match:", textMatch);
      
      if (chatIdMatch && textMatch) {
        // Limpa o texto de caracteres especiais
        let cleanText = textMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        
        payload = {
          chat_id: chatIdMatch[1],
          text: cleanText
        };
        
        adicionarLog('json_recovery', 'Dados extraídos com sucesso do JSON inválido', {
          chat_id: payload.chat_id,
          textLength: payload.text.length,
          originalBody: req.body.substring(0, 200) + '...'
        });
        
        console.log("✅ Dados extraídos:", payload);
      } else {
        console.error("❌ Não foi possível extrair chat_id ou text do JSON inválido");
        console.error("❌ Body recebido:", req.body);
        return res.status(400).send("Erro ao parsear JSON");
      }
    }
  } else {
    adicionarLog('json_parse', 'Payload já era objeto JSON', {
      keys: Object.keys(payload)
    });
  }

  const { chat_id, text } = payload;

  if (!chat_id || !text) {
    adicionarLog('erro', 'Campos obrigatórios ausentes', {
      chat_id: !!chat_id,
      text: !!text,
      payload: payload
    });
    console.warn("⚠️ chat_id ou text ausentes");
    return res.status(400).send("chat_id e text obrigatórios");
  }

  adicionarLog('validacao', 'Campos obrigatórios validados', {
    chat_id: chat_id,
    textLength: text.length
  });

  const alerta = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    chat_id,
    text,
    ip: req.ip || req.connection.remoteAddress
  };

  alertasRecebidos.push(alerta);

  if (alertasRecebidos.length > MAX_ALERTAS) {
    alertasRecebidos = alertasRecebidos.slice(-MAX_ALERTAS);
  }

  salvarAlertas();
  console.log("📝 Alerta salvo:", alerta);

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    adicionarLog('telegram_envio', 'Iniciando envio ao Telegram', {
      chat_id: chat_id,
      textLength: text.length
    });

    const response = await axios.post(url, {
      chat_id,
      text,
      parse_mode: "Markdown"
    });

    adicionarLog('telegram_sucesso', 'Mensagem enviada com sucesso', {
      messageId: response.data?.result?.message_id,
      chatId: response.data?.result?.chat?.id,
      telegramResponse: response.data
    });

    console.log("✅ Mensagem enviada com sucesso:", response.data);
    res.send("Mensagem enviada com sucesso");
  } catch (error) {
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