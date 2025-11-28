import "dotenv/config";
import { WebSocketServer } from "ws";
import { handleMessage, handleDisconnect } from "./websocket.js";

const PORT = process.env.PORT || 8080;

// Map de conexões -> metadata do cliente
// ws => { clientId, roomId, language }
const clients = new Map();

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", async (data) => {
    try {
      const rawData = data.toString();

      // Tentar parse como JSON
      let msg;
      try {
        msg = JSON.parse(rawData);
      } catch {
        // String simples - converter para utterance automático
        console.log(`📝 Received plain text: "${rawData}"`);

        // Obter metadata do cliente (se já fez join)
        const clientData = clients.get(ws);

        // Criar mensagem utterance automaticamente
        msg = {
          type: "utterance",
          utteranceId: `msg-${Date.now()}`,
          speakerId: clientData?.clientId || "unknown",
          roomId: clientData?.roomId || "default-room",
          language: clientData?.language || "pt-BR",
          text: rawData,
        };

        console.log("🔄 Converted to utterance:", msg);
      }

      await handleMessage(ws, msg, clients);
    } catch (err) {
      console.error("Error handling message:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Error processing message",
        })
      );
    }
  });

  ws.on("close", () => {
    handleDisconnect(ws, clients);
  });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
