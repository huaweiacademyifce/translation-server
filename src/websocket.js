import { translateText } from "./translation.js";
import { getRoomClients } from "./room.js";

export async function handleMessage(ws, msg, clients, connId = "?") {
  const msgTimestamp = new Date().toLocaleTimeString("pt-BR");

  console.log(`\n${"─".repeat(80)}`);
  console.log(`⚙️  [${msgTimestamp}] PROCESSANDO MENSAGEM (Conn #${connId})`);
  console.log(`${"─".repeat(80)}`);
  console.log(`📋 Tipo: ${msg.type}`);

  switch (msg.type) {
    case "join":
      return handleJoin(ws, msg, clients, connId);
    case "utterance":
      return handleUtterance(ws, msg, clients, connId);
    default:
      console.error(`❌ Tipo de mensagem desconhecido: ${msg.type}`);
      ws.send(JSON.stringify({ type: "error", message: "Unknown type" }));
  }
}

export function handleDisconnect(ws, clients) {
  const meta = clients.get(ws);
  if (meta) {
    console.log(`🔌 Cliente desconectado: ${meta.clientId}`);
  }
  clients.delete(ws);
}

function handleJoin(ws, msg, clients, connId) {
  const { clientId, roomId, language } = msg;
  const timestamp = new Date().toLocaleTimeString("pt-BR");

  console.log(`\n✅ [${timestamp}] PROCESSADOR: JOIN`);
  console.log(`${"─".repeat(80)}`);
  console.log(`👤 Cliente ID: ${clientId}`);
  console.log(`🏠 Sala: ${roomId}`);
  console.log(`🗣️  Idioma: ${language}`);

  // Armazenar metadata
  clients.set(ws, { clientId, roomId, language });

  // Contar clientes na sala
  const roomClients = getRoomClients(roomId, clients);
  console.log(`📊 Clientes na sala "${roomId}": ${roomClients.length}`);
  console.log(
    `📝 Idiomas na sala: ${[
      ...new Set(roomClients.map((c) => c[1].language)),
    ].join(", ")}`
  );

  // Enviar confirmação JOIN
  const joinResponse = { type: "joined", clientId, roomId };
  console.log(`\n📤 Enviando confirmação de JOIN:`);
  console.log(JSON.stringify(joinResponse, null, 2));
  ws.send(JSON.stringify(joinResponse));

  console.log(`\n✅ JOIN PROCESSADO COM SUCESSO\n`);
}

async function handleUtterance(ws, msg, clients, connId) {
  const { utteranceId, speakerId, roomId, language, text } = msg;
  const timestamp = new Date().toLocaleTimeString("pt-BR");

  console.log(`\n✅ [${timestamp}] PROCESSADOR: UTTERANCE`);
  console.log(`${"─".repeat(80)}`);
  console.log(`👤 Falante: ${speakerId}`);
  console.log(`🏠 Sala: ${roomId}`);
  console.log(`🗣️  Idioma: ${language}`);
  console.log(`📝 Texto: "${text}"`);
  console.log(`🆔 ID da mensagem: ${utteranceId}`);

  // Obter clientes na sala
  const roomClients = getRoomClients(roomId, clients);
  console.log(`\n📊 Clientes na sala "${roomId}": ${roomClients.length}`);

  if (roomClients.length === 0) {
    console.warn(
      `⚠️  AVISO: Nenhum cliente na sala "${roomId}" para receber tradução`
    );
    return;
  }

  // Para cada cliente na sala
  console.log(`\n🔄 ENVIANDO PARA CADA CLIENTE NA SALA:`);
  let index = 0;
  for (const [clientWs, meta] of roomClients) {
    index++;
    console.log(
      `\n  [${index}/${roomClients.length}] Cliente: ${meta.clientId}`
    );
    console.log(`      Idioma: ${meta.language}`);

    const targetLanguage = meta.language;
    const sameLanguage = language === targetLanguage;

    console.log(`      Tradução necessária: ${sameLanguage ? "NÃO" : "SIM"}`);
    console.log(`      ${language} → ${targetLanguage}`);

    let translatedText = text;
    if (!sameLanguage) {
      console.log(`      🔄 Traduzindo...`);
      try {
        translatedText = await translateText({
          text,
          from: language,
          to: targetLanguage,
        });
        console.log(`      ✅ Tradução: "${translatedText}"`);
      } catch (err) {
        console.error(`      ❌ Erro na tradução:`, err.message);
        translatedText = text; // Fallback
        console.log(`      ⚠️  Usando texto original como fallback`);
      }
    } else {
      console.log(`      ℹ️  Usando texto original (mesmo idioma)`);
    }

    // Construir payload
    const payload = {
      type: "transcription",
      utteranceId: utteranceId || null,
      speakerId,
      roomId,
      originalLanguage: language,
      targetLanguage,
      text: translatedText,
    };

    console.log(`      📦 Enviando payload:`);
    console.log(`      ${JSON.stringify(payload)}`);

    // Enviar
    try {
      clientWs.send(JSON.stringify(payload));
      console.log(`      ✅ Enviado com sucesso`);
    } catch (err) {
      console.error(`      ❌ Erro ao enviar:`, err.message);
    }
  }

  console.log(`\n✅ UTTERANCE PROCESSADO COM SUCESSO\n`);
}
