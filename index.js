const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.text({ type: "*/*" })); // aceita JSON ou texto puro

const TELEGRAM_BOT_TOKEN = "7967775347:AAEGmdVgEvksdPnz2195rNKNgdjb_PkhMYA";

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
