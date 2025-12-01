import "dotenv/config";
import { WebSocketServer } from "ws";
import { handleMessage, handleDisconnect } from "./websocket.js";

const PORT = process.env.PORT || 8080;

// Map de conexões -> metadata do cliente
// ws => { clientId, roomId, language }
const clients = new Map();

const wss = new WebSocketServer({ port: PORT });

// Rastrear ID único para cada conexão (para logs)
let connectionCounter = 0;

wss.on("connection", (ws) => {
  const connId = ++connectionCounter;
  const timestamp = new Date().toLocaleTimeString("pt-BR");

  console.log(`\n${"=".repeat(80)}`);
  console.log(`✅ [${timestamp}] CONEXÃO #${connId} ACEITA`);
  console.log(`${"=".repeat(80)}`);
  console.log(`📊 Total de clientes conectados: ${wss.clients.size}`);
  console.log();

  ws.on("message", async (data) => {
    try {
      const rawData = data.toString();
      const msgTimestamp = new Date().toLocaleTimeString("pt-BR");

      console.log(`\n${"─".repeat(80)}`);
      console.log(
        `📨 [${msgTimestamp}] MENSAGEM RECEBIDA (Conexão #${connId})`
      );
      console.log(`${"─".repeat(80)}`);
      console.log(
        `📦 Dados brutos: ${rawData.substring(0, 100)}${
          rawData.length > 100 ? "..." : ""
        }`
      );
      console.log(`📏 Tamanho: ${rawData.length} bytes`);

      // Tentar parse como JSON
      let msg;
      try {
        msg = JSON.parse(rawData);
        console.log(`✅ JSON válido detectado`);
        console.log(`📋 Tipo de mensagem: ${msg.type}`);
        console.log(`📋 Conteúdo:`);
        console.log(JSON.stringify(msg, null, 2));
      } catch (parseError) {
        // String simples - converter para utterance automático
        console.log(`⚠️  Não é JSON, detectado como string simples`);
        console.log(`📝 Texto recebido: "${rawData}"`);

        // Obter metadata do cliente (se já fez join)
        const clientData = clients.get(ws);

        console.log(`\n🔄 CONVERSÃO AUTOMÁTICA (Compatibilidade)`);
        console.log(`ℹ️  clientData encontrado: ${clientData ? "SIM" : "NÃO"}`);
        if (clientData) {
          console.log(`   - clientId: ${clientData.clientId}`);
          console.log(`   - roomId: ${clientData.roomId}`);
          console.log(`   - language: ${clientData.language}`);
        }

        // Criar mensagem utterance automaticamente
        msg = {
          type: "utterance",
          utteranceId: `msg-${Date.now()}`,
          speakerId: clientData?.clientId || "unknown",
          roomId: clientData?.roomId || "default-room",
          language: clientData?.language || "pt-BR",
          text: rawData,
        };

        console.log(`✅ Mensagem convertida para:`);
        console.log(JSON.stringify(msg, null, 2));
      }

      console.log(`\n🔀 ROTEANDO PARA HANDLER...`);
      await handleMessage(ws, msg, clients, connId);
    } catch (err) {
      console.error(`\n❌ ERRO ao processar mensagem:`, err);
      console.error(err.stack);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Error processing message",
        })
      );
    }
  });

  ws.on("close", () => {
    const clientData = clients.get(ws);
    const closeTimestamp = new Date().toLocaleTimeString("pt-BR");
    console.log(`\n${"=".repeat(80)}`);
    console.log(`❌ [${closeTimestamp}] CONEXÃO #${connId} FECHADA`);
    if (clientData) {
      console.log(`   Cliente: ${clientData.clientId}`);
      console.log(`   Sala: ${clientData.roomId}`);
      console.log(`   Idioma: ${clientData.language}`);
    }
    console.log(`📊 Clientes restantes: ${wss.clients.size - 1}`);
    console.log(`${"=".repeat(80)}\n`);
    handleDisconnect(ws, clients);
  });

  ws.on("error", (err) => {
    const errorTimestamp = new Date().toLocaleTimeString("pt-BR");
    console.error(`\n❌ [${errorTimestamp}] ERRO NA CONEXÃO #${connId}:`);
    console.error(err);
  });
});

const timestamp = new Date().toLocaleTimeString("pt-BR");
console.log(`\n${"=".repeat(80)}`);
console.log(`🚀 [${timestamp}] SERVIDOR WEBSOCKET INICIADO`);
console.log(`${"=".repeat(80)}`);
console.log(`🌐 URL: ws://localhost:${PORT}`);
console.log(`🌐 URL (Rede local): ws://[SEU_IP]:${PORT}`);
console.log(`📊 Porta: ${PORT}`);
console.log(`${"=".repeat(80)}\n`);
