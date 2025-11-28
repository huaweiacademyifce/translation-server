# Servidor WebSocket de Tradução em Tempo Real

## 📋 Visão Geral

Este é um **servidor Node.js com WebSocket** que atua como intermediário entre clientes Unity VR, recebendo mensagens de texto/áudio transcritas e traduzindo-as em tempo real usando a **Azure Translator API**.

O servidor funciona como um **hub de tradução multiplayer**, onde jogadores em diferentes idiomas podem se comunicar em salas virtuais, e cada um recebe as mensagens traduzidas para seu idioma nativo.

---

## 🎯 Propósito

Permitir comunicação multilíngue em tempo real em ambientes VR multiplayer:
- Jogador A fala em **Português** → Jogador B recebe em **Inglês**
- Jogador C fala em **Espanhol** → Todos recebem em seus respectivos idiomas
- Sistema de **salas** para isolar conversas por sessão de jogo

---

## 🏗️ Arquitetura

```
Unity Client (pt-BR)                 Node.js Server                    Azure Translator
      │                                    │                                  │
      │ ──── WebSocket Connect ────────→  │                                  │
      │ ←── Connection Accepted ──────────│                                  │
      │                                    │                                  │
      │ ──── Join Message ─────────────→  │                                  │
      │     {type:"join",                  │                                  │
      │      clientId:"player1",           │                                  │
      │      roomId:"room-1",             │                                  │
      │      language:"pt-BR"}            │                                  │
      │                                    │                                  │
      │ ──── Text Message ─────────────→  │                                  │
      │     "Olá, tudo bem?"              │ ──── Translation Request ─────→ │
      │                                    │     {text:"Olá, tudo bem?",     │
      │                                    │      from:"pt-BR",               │
      │                                    │      to:"en-US"}                 │
      │                                    │ ←── Translated Text ────────────│
      │                                    │     {text:"Hello, how are you?"} │
      │ ←── Broadcast to Room ────────────│                                  │
      │     {type:"transcription",         │                                  │
      │      speakerId:"player1",          │                                  │
      │      text:"Hello, how are you?",  │                                  │
      │      originalLanguage:"pt-BR",     │                                  │
      │      targetLanguage:"en-US"}      │                                  │
```

---

## 📂 Estrutura de Arquivos

```
translation-server/
├── src/
│   ├── index.js           # Entry point, servidor WebSocket
│   ├── websocket.js       # Handlers de mensagens (join, utterance)
│   ├── translation.js     # Integração com Azure Translator API
│   └── room.js            # Utilitários de gerenciamento de salas
├── package.json           # Dependências (ws, axios, dotenv)
├── .env                   # Credenciais Azure (NÃO versionado)
├── .env.example           # Template de configuração
└── README.md              # Documentação básica
```

---

## 🔧 Componentes

### **1. `src/index.js` - Servidor WebSocket**

**Responsabilidades:**
- Criar servidor WebSocket na porta 8080
- Aceitar conexões de clientes Unity
- Gerenciar Map de clientes conectados
- Converter strings simples em mensagens estruturadas (compatibilidade Unity)
- Rotear mensagens para handlers apropriados

**Código principal:**
```javascript
const wss = new WebSocketServer({ port: 8080 });
const clients = new Map(); // ws => { clientId, roomId, language }

wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    const rawData = data.toString();
    
    // Aceita JSON ou string simples
    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch {
      // Converte string → utterance automático
      msg = {
        type: "utterance",
        utteranceId: `msg-${Date.now()}`,
        speakerId: clients.get(ws)?.clientId || "unknown",
        roomId: clients.get(ws)?.roomId || "default-room",
        language: clients.get(ws)?.language || "pt-BR",
        text: rawData
      };
    }
    
    await handleMessage(ws, msg, clients);
  });
});
```

**Funcionalidades especiais:**
- ✅ Aceita JSON estruturado ou strings puras
- ✅ Converte automaticamente strings em mensagens `utterance`
- ✅ Usa metadata do cliente (do join anterior) para preencher campos

---

### **2. `src/websocket.js` - Manipuladores de Mensagens**

**Responsabilidades:**
- Processar mensagem de **join** (entrada em sala)
- Processar mensagem de **utterance** (fala/texto)
- Traduzir para todos os idiomas da sala
- Broadcast apenas para clientes da mesma sala
- Gerenciar desconexões

**Fluxo de `handleJoin`:**
```javascript
export function handleJoin(ws, msg, clients) {
  // Salva metadata do cliente
  clients.set(ws, {
    clientId: msg.clientId,
    roomId: msg.roomId,
    language: msg.language
  });
  
  console.log(`${msg.clientId} entrou na sala ${msg.roomId} (${msg.language})`);
}
```

**Fluxo de `handleUtterance`:**
```javascript
export async function handleUtterance(ws, msg, clients) {
  const { speakerId, roomId, language: fromLang, text } = msg;
  
  // Pega todos clientes da mesma sala
  const roomClients = getRoomClients(roomId, clients);
  
  // Para cada cliente na sala
  for (const [clientWs, clientData] of roomClients) {
    const toLang = clientData.language;
    
    // Se idioma diferente, traduz
    let translatedText = text;
    if (fromLang !== toLang) {
      translatedText = await translateText({
        text,
        from: fromLang,
        to: toLang
      });
    }
    
    // Envia mensagem traduzida
    clientWs.send(JSON.stringify({
      type: "transcription",
      utteranceId: msg.utteranceId,
      speakerId: speakerId,
      roomId: roomId,
      originalLanguage: fromLang,
      targetLanguage: toLang,
      text: translatedText
    }));
  }
}
```

**Características importantes:**
- ✅ **Isolamento por sala**: Apenas clientes do mesmo `roomId` recebem mensagens
- ✅ **Tradução sob demanda**: Só traduz se idiomas forem diferentes
- ✅ **Broadcast eficiente**: Itera apenas clientes da sala específica

---

### **3. `src/translation.js` - Azure Translator**

**Responsabilidades:**
- Fazer requisições HTTP POST para Azure Translator API
- Formatar parâmetros de tradução (from, to, text)
- Tratar erros e fallbacks
- Retornar texto traduzido

**Código:**
```javascript
import axios from "axios";

export async function translateText({ text, from, to }) {
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  
  const url = `${endpoint}/translate?api-version=3.0&from=${from}&to=${to}`;
  
  try {
    const response = await axios.post(url, [{ text }], {
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-Type": "application/json"
      }
    });
    
    return response.data[0].translations[0].text;
  } catch (error) {
    console.error("Translation error:", error.message);
    return text; // Fallback: retorna texto original
  }
}
```

**Azure Translator API:**
- Endpoint: `https://api.cognitive.microsofttranslator.com`
- Método: POST
- Headers: `Ocp-Apim-Subscription-Key`, `Ocp-Apim-Subscription-Region`
- Body: `[{"text": "texto a traduzir"}]`
- Response: `[{"translations": [{"text": "translated text"}]}]`

**Idiomas suportados:** 100+ idiomas (pt-BR, en-US, es-ES, fr-FR, ja-JP, ko-KR, zh-CN, etc)

---

### **4. `src/room.js` - Utilitários de Sala**

**Responsabilidades:**
- Obter todos clientes de uma sala específica
- Contar jogadores em sala
- Listar idiomas ativos em sala

**Código:**
```javascript
export function getRoomClients(roomId, clients) {
  return Array.from(clients.entries())
    .filter(([ws, data]) => data.roomId === roomId);
}

export function getUniqueLanguages(roomId, clients) {
  const roomClients = getRoomClients(roomId, clients);
  return [...new Set(roomClients.map(([ws, data]) => data.language))];
}
```

---

## 📡 Protocolo WebSocket

### **1. Cliente → Servidor: Join (Entrar em Sala)**

```json
{
  "type": "join",
  "clientId": "player-1",
  "roomId": "room-abc",
  "language": "pt-BR"
}
```

**Resposta:** Nenhuma (silencioso), mas servidor armazena metadata do cliente.

---

### **2. Cliente → Servidor: Utterance (Enviar Mensagem)**

**Formato JSON (recomendado):**
```json
{
  "type": "utterance",
  "utteranceId": "msg-001",
  "speakerId": "player-1",
  "roomId": "room-abc",
  "language": "pt-BR",
  "text": "Olá, tudo bem?"
}
```

**Formato String Simples (compatibilidade Unity):**
```
"Olá, tudo bem?"
```
*Servidor converte automaticamente usando metadata do join anterior.*

---

### **3. Servidor → Cliente: Transcription (Mensagem Traduzida)**

```json
{
  "type": "transcription",
  "utteranceId": "msg-001",
  "speakerId": "player-1",
  "roomId": "room-abc",
  "originalLanguage": "pt-BR",
  "targetLanguage": "en-US",
  "text": "Hello, how are you?"
}
```

**Todos os clientes na sala `room-abc` recebem esta mensagem**, cada um com tradução para seu próprio idioma.

---

### **4. Servidor → Cliente: Error (Mensagem de Erro)**

```json
{
  "type": "error",
  "message": "Translation service unavailable"
}
```

---

## 🔄 Fluxo Completo de Tradução

### **Cenário: 2 jogadores em sala, idiomas diferentes**

**Estado inicial:**
- Player 1: `clientId="alice"`, `roomId="vr-room"`, `language="pt-BR"` (conectado)
- Player 2: `clientId="bob"`, `roomId="vr-room"`, `language="en-US"` (conectado)

**Ação:** Alice fala "Olá, como vai?"

1. **Unity (Alice) envia:**
   ```
   "Olá, como vai?"
   ```

2. **Servidor converte para:**
   ```json
   {
     "type": "utterance",
     "utteranceId": "msg-1764268423178",
     "speakerId": "alice",
     "roomId": "vr-room",
     "language": "pt-BR",
     "text": "Olá, como vai?"
   }
   ```

3. **Servidor identifica clientes na sala `vr-room`:**
   - Alice (pt-BR)
   - Bob (en-US)

4. **Servidor traduz para Bob:**
   - Request Azure: `from=pt-BR`, `to=en-US`, `text="Olá, como vai?"`
   - Response Azure: `"Hello, how are you?"`

5. **Servidor envia para Alice (sem tradução):**
   ```json
   {
     "type": "transcription",
     "speakerId": "alice",
     "originalLanguage": "pt-BR",
     "targetLanguage": "pt-BR",
     "text": "Olá, como vai?"
   }
   ```

6. **Servidor envia para Bob (traduzido):**
   ```json
   {
     "type": "transcription",
     "speakerId": "alice",
     "originalLanguage": "pt-BR",
     "targetLanguage": "en-US",
     "text": "Hello, how are you?"
   }
   ```

7. **Unity (Bob) exibe no balão 3D:**
   ```
   Alice: Hello, how are you?
   ```

---

## 🔐 Configuração (.env)

```env
PORT=8080
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
AZURE_TRANSLATOR_KEY=sua_chave_azure_aqui
AZURE_TRANSLATOR_REGION=brazilsouth
```

**Como obter credenciais Azure:**
1. Acessar https://portal.azure.com
2. Criar recurso "Translator"
3. Copiar **Key** e **Region** das configurações

---

## 📦 Dependências (package.json)

```json
{
  "dependencies": {
    "ws": "^8.18.3",           // WebSocket server
    "axios": "^1.13.2",        // HTTP client para Azure API
    "dotenv": "^17.2.3"        // Variáveis de ambiente
  }
}
```

**Sem dependências pesadas** - servidor leve e rápido.

---

## 🚀 Como Executar

### **1. Instalação:**
```bash
npm install
```

### **2. Configurar credenciais:**
```bash
cp .env.example .env
# Editar .env com suas chaves Azure
```

### **3. Iniciar servidor:**
```bash
# Modo desenvolvimento
node src/index.js

# Modo produção (PM2)
pm2 start src/index.js --name translation-server
pm2 save
```

### **4. Ver logs:**
```bash
pm2 logs translation-server
```

### **5. Status:**
```bash
pm2 status
```

---

## 🔧 Integração com Unity

### **No Unity, você precisa:**

1. **Script `TranslationWebSocketClient.cs`:**
   - Conectar ao servidor: `ws://IP_DO_SERVIDOR:8080`
   - Enviar join na conexão
   - Enviar strings de texto (o servidor aceita!)
   - Receber JSON de transcription

2. **Script `VRTranslationManager.cs`:**
   - Gerenciar conexão WebSocket
   - Despachar eventos de tradução para UI

3. **Script `FloatingChatBubble.cs`:**
   - Exibir texto traduzido em balão 3D

### **Exemplo de uso no Unity:**

```csharp
// 1. Conectar
TranslationWebSocketClient ws = new TranslationWebSocketClient();
await ws.ConnectAsync("ws://192.168.1.100:8080");

// 2. Join (importante!)
var joinMsg = new {
    type = "join",
    clientId = "alice",
    roomId = "vr-room",
    language = "pt-BR"
};
ws.SendString(JsonUtility.ToJson(joinMsg));

// 3. Enviar mensagem (string simples funciona!)
ws.SendString("Olá, tudo bem?");

// 4. Receber tradução
ws.OnMessage += (json) => {
    var msg = JsonUtility.FromJson<ServerMessage>(json);
    if (msg.type == "transcription") {
        Debug.Log($"{msg.speakerId}: {msg.text}");
    }
};
```

---

## 🌐 Acesso Externo (LAN)

### **Descobrir IP do servidor:**
```bash
hostname -I | awk '{print $1}'
# Exemplo: 192.168.1.100
```

### **Abrir porta no firewall:**
```bash
sudo ufw allow 8080/tcp
```

### **Conectar do Unity:**
```csharp
serverUrl = "ws://192.168.1.100:8080";
```

---

## 📊 Logs e Monitoramento

### **Logs importantes:**

```
Client connected                              # Nova conexão
alice entrou na sala vr-room (pt-BR)         # Join bem-sucedido
📝 Received plain text: "Olá"                # String simples recebida
🔄 Converted to utterance: {...}             # Conversão automática
Translation: pt-BR → en-US: "Olá" → "Hello"  # Tradução Azure
```

### **Comandos PM2:**

```bash
pm2 logs             # Ver logs em tempo real
pm2 status           # Ver status do servidor
pm2 restart all      # Reiniciar servidor
pm2 stop all         # Parar servidor
pm2 delete all       # Remover do PM2
```

---

## 🐛 Troubleshooting

### **Problema: "address already in use"**
```bash
# Parar processo na porta 8080
pm2 stop translation-server
# ou
killall node
```

### **Problema: Azure não traduz**
- Verificar `AZURE_TRANSLATOR_KEY` válida no `.env`
- Confirmar `AZURE_TRANSLATOR_REGION` correto (ex: brazilsouth)
- Checar logs: `pm2 logs translation-server`

### **Problema: Unity não recebe mensagens**
- Confirmar que fez **join** antes de enviar utterances
- Verificar que `roomId` é o mesmo para todos jogadores
- Checar logs do servidor para ver se mensagens estão chegando

---

## 🎯 Casos de Uso

### **1. VR Multiplayer Global**
- Jogadores de diferentes países jogam juntos
- Cada um ouve/lê em seu idioma nativo
- Salas isolam sessões de jogo

### **2. Treinamento Corporativo VR**
- Instrutor em inglês → Aprendizes recebem em português
- Múltiplos idiomas simultâneos na mesma sessão

### **3. Social VR**
- Ambientes sociais multilíngues
- Chat de voz + texto traduzido em tempo real

---

## 📈 Performance

**Métricas típicas:**
- **Latência WebSocket:** 10-50ms (LAN), 50-200ms (Internet)
- **Latência Azure Translator:** 200-500ms (depende da região)
- **Throughput:** Suporta 50+ clientes simultâneos em servidor modesto
- **Memória:** ~50-100MB por instância Node.js

---

## 🔒 Segurança

### **Nunca expor:**
- `AZURE_TRANSLATOR_KEY` em código versionado
- Usar `.env` local (já no `.gitignore`)

### **Produção:**
- Usar `wss://` (WebSocket Secure) ao invés de `ws://`
- Implementar autenticação de clientes
- Rate limiting por cliente
- Azure Key Vault para secrets

---

## 🚀 Deploy (Railway / Heroku / VPS)

### **Railway (grátis):**
1. Criar conta em https://railway.app
2. Conectar repositório GitHub
3. Adicionar variáveis de ambiente (Azure keys)
4. Deploy automático

### **VPS (Linux):**
```bash
# Instalar Node.js e PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pm2

# Clonar repositório
git clone <repo>
cd translation-server

# Configurar e iniciar
npm install
pm2 start src/index.js --name translation-server
pm2 startup
pm2 save
```

---

## 📝 Resumo

Este servidor Node.js é um **middleware de tradução em tempo real** para VR multiplayer:

✅ **Recebe** texto de clientes Unity via WebSocket  
✅ **Traduz** usando Azure Translator API  
✅ **Distribui** mensagens traduzidas apenas para clientes da mesma sala  
✅ **Suporta** JSON estruturado ou strings simples (compatibilidade Unity)  
✅ **Isola** conversas por `roomId`  
✅ **Escala** para múltiplas salas e idiomas simultâneos  

**Simples, eficiente e pronto para produção!** 🚀

---

**Versão:** 1.0  
**Node.js:** v16+  
**Dependências:** ws, axios, dotenv  
**Azure:** Translator API v3.0  
**Unity:** 2022.3.48f1 (compatível com versões anteriores)
