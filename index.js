const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.text({ type: "*/*" })); // aceita JSON ou texto puro

const TELEGRAM_BOT_TOKEN = "7967775347:AAEGmdVgEvksdPnz2195rNKNgdjb_PkhMYA";

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

app.post("/", async (req, res) => {
  console.log("🔔 Webhook recebido");

  let payload = req.body;

  // Log bruto da requisição recebida
  console.log("📦 Body recebido:", payload);

  // Se for string (como vem do TradingView), tenta converter
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (err) {
      console.error("❌ Erro ao fazer parse do JSON:", err.message);
      return res.status(400).send("Erro ao parsear JSON");
    }
  }

  const { chat_id, text } = payload;

  // Verifica se os campos obrigatórios existem
  if (!chat_id || !text) {
    console.warn("⚠️ chat_id ou text ausentes");
    return res.status(400).send("chat_id e text obrigatórios");
  }

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
    const response = await axios.post(url, {
      chat_id,
      text,
      parse_mode: "Markdown"
    });

    console.log("✅ Mensagem enviada com sucesso:", response.data);
    res.send("Mensagem enviada com sucesso");
  } catch (error) {
    console.error("❌ Erro ao enviar para o Telegram:", error.response?.data || error.message);
    res.status(500).send("Erro ao enviar para o Telegram");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
