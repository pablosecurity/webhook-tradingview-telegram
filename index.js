const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = '7967775347:AAEGmdVgEvksdPnz2195rNKNgdjb_PkhMYA';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Webhook TradingView -> Telegram está funcionando!' });
});

app.post('/', async (req, res) => {
  const { chat_id, text } = req.body;

  if (!chat_id || !text) {
    return res.status(400).json({ error: 'Os campos chat_id e text são obrigatórios.' });
  }

  try {
    const response = await axios.post(TELEGRAM_API_URL, {
      chat_id,
      text
    });
    if (response.data && response.data.ok) {
      return res.sendStatus(200);
    } else {
      return res.status(500).json({ error: 'Falha ao enviar mensagem para o Telegram.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao enviar mensagem para o Telegram.', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor webhook rodando na porta ${PORT}`);
}); 