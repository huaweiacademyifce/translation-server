# Translation Server - Documentação Completa

**Sistema de tradução em tempo real via WebSocket + Azure Translator para Unity VR Multiplayer.**

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Como Executar](#-como-executar)
3. [Configuração](#-configuração)
4. [Arquitetura](#-arquitetura)
5. [Componentes](#-componentes)
6. [Protocolo WebSocket](#-protocolo-websocket)
7. [Padrão de Mensagens](#-padrão-de-mensagens-unity--servidor)
8. [Fluxo Completo](#-fluxo-completo-de-tradução)
9. [Integração Unity](#-integração-com-unity)
10. [Deploy](#-deploy-acesso-externo)

---

## 🎯 Visão Geral

Este é um **servidor Node.js com WebSocket** que atua como intermediário entre clientes Unity VR, recebendo mensagens de texto/áudio transcritas e traduzindo-as em tempo real usando a **Azure Translator API**.

O servidor funciona como um **hub de tradução multiplayer**, onde jogadores em diferentes idiomas podem se comunicar em salas virtuais, e cada um recebe as mensagens traduzidas para seu idioma nativo.

### Principais características:

✅ Tradução em tempo real entre 100+ idiomas  
✅ Sistema de salas isoladas  
✅ Suporta JSON estruturado ou strings simples  
✅ Reconexão automática  
✅ Compatível com Meta Quest VR  
✅ Baixa latência (<500ms)  

---

## 🚀 Como Executar

### **1. Instalar dependências:**
```bash
npm install
```

### **2. Configurar credenciais Azure:**
```bash
cp .env.example .env
# Editar .env com suas chaves Azure
```

### **3. Iniciar servidor:**

**Modo desenvolvimento:**
```bash
node src/index.js
```

**Modo produção (PM2):**
```bash
pm2 start src/index.js --name translation-server
pm2 logs translation-server
```

Servidor estará rodando em: **`ws://localhost:8080`**

---

## ⚙️ Configuração

### **.env (Variáveis de Ambiente)**

```env
PORT=8080
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
AZURE_TRANSLATOR_KEY=sua_chave_azure_aqui
AZURE_TRANSLATOR_REGION=brazilsouth
```

### **Como obter credenciais Azure:**

1. Acessar https://portal.azure.com
2. Criar recurso **"Translator"**
3. Copiar **Subscription Key** e **Region** das configurações
4. Cole no arquivo `.env`

> ⚠️ **NUNCA comitar credenciais reais!** Use `.gitignore` para `.env`

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                          Camada de Clientes                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Unity Player 1 (pt-BR)    Unity Player 2 (en-US)               │
│  ├─ ClientId: alice        ├─ ClientId: bob                     │
│  ├─ RoomId: vr-room        ├─ RoomId: vr-room                   │
│  └─ Language: pt-BR        └─ Language: en-US                   │
│           │                          │                           │
└───────────┼──────────────────────────┼───────────────────────────┘
            │                          │
            │    WebSocket JSON        │
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Node.js Server                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. index.js - WebSocket Server (porta 8080)                   │
│     └─ Aceita conexões e roteia mensagens                       │
│                                                                   │
│  2. websocket.js - Handlers                                    │
│     ├─ handleJoin() - Entrada em sala                          │
│     └─ handleUtterance() - Processamento de mensagens          │
│                                                                   │
│  3. translation.js - Azure Integration                         │
│     └─ translateText() - Requisição HTTP para Azure            │
│                                                                   │
│  4. room.js - Gerenciamento de Salas                           │
│     └─ getRoomClients() - Buscar clientes por sala             │
│                                                                   │
└───────────────┬────────────────────────────────────────────────┘
                │
                │ HTTP POST /translate
                │ (from, to, text)
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Azure Translator API                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Endpoint: https://api.cognitive.microsofttranslator.com        │
│  Suporta: 100+ idiomas (pt-BR, en-US, es-ES, fr-FR, etc)      │
│  Latência: 200-500ms                                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Componentes

### **1. `src/index.js` - Servidor WebSocket**

**Responsabilidades:**
- Criar servidor WebSocket na porta 8080
- Aceitar conexões de clientes Unity
- Converter strings simples em mensagens estruturadas
- Rotear mensagens para handlers

**Recursos principais:**
- ✅ Aceita JSON ou string simples
- ✅ Gerencia Map de clientes conectados
- ✅ Compatibilidade com código Unity legado

---

### **2. `src/websocket.js` - Manipuladores de Mensagens**

**Responsabilidades:**
- Processar mensagem de **join**
- Processar mensagem de **utterance**
- Traduzir para todos os idiomas da sala
- Fazer broadcast apenas para clientes da mesma sala

**Fluxo:**
1. Recebe mensagem de cliente
2. Valida tipo (join/utterance)
3. Se utterance: traduz para cada idioma da sala
4. Envia resposta "transcription" para todos na sala

---

### **3. `src/translation.js` - Azure Translator**

**Responsabilidades:**
- Fazer requisições HTTP POST para Azure
- Formatar parâmetros de tradução
- Tratar erros e fallbacks

**Resposta da Azure:**
```json
[{"translations": [{"text": "texto traduzido"}]}]
```

---

### **4. `src/room.js` - Gerenciamento de Salas**

**Responsabilidades:**
- Obter clientes de uma sala específica
- Filtrar por roomId
- Listar idiomas ativos em sala

---

## 📡 Protocolo WebSocket

### **Tipos de Mensagens:**

1. **JOIN** - Entrar em sala
2. **UTTERANCE** - Enviar mensagem
3. **TRANSCRIPTION** - Receber tradução (resposta do servidor)
4. **ERROR** - Erro do servidor

---

## 📝 Padrão de Mensagens (Unity ↔ Servidor)

### **Unity → Servidor**

#### **Opção 1: String Simples (Compatibilidade)**

```
"Olá, tudo bem?"
```

**O servidor converte automaticamente para:**
```json
{
  "type": "utterance",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",          // do join anterior
  "roomId": "vr-room",           // do join anterior
  "language": "pt-BR",           // do join anterior
  "text": "Olá, tudo bem?"
}
```

**Quando usar:** Quando você está enviando apenas texto simples (compatível com `TranslationWebSocketClient.SendString()`)

---

#### **Opção 2: JSON Estruturado (Recomendado)**

**Mensagem JOIN (obrigatória):**
```json
{
  "type": "join",
  "clientId": "alice",
  "roomId": "vr-room",
  "language": "pt-BR"
}
```

**Servidor recebe:** Registra `clientId`, `roomId`, `language` na Map de clientes

**Mensagem UTTERANCE (após join):**
```json
{
  "type": "utterance",
  "utteranceId": "msg-001",
  "speakerId": "alice",
  "roomId": "vr-room",
  "language": "pt-BR",
  "text": "Olá, tudo bem?"
}
```

**Campos obrigatórios:**
- `type`: sempre "utterance"
- `speakerId`: ID único do jogador
- `roomId`: ID da sala (para isolar conversas)
- `language`: idioma da mensagem (ex: pt-BR, en-US)
- `text`: texto a traduzir

**Campos opcionais:**
- `utteranceId`: ID único para rastrear mensagem (servidor gera se não informado)

---

### **Servidor → Unity**

#### **Mensagem TRANSCRIPTION (resposta)**

O servidor envia esta mensagem para **TODOS os clientes da sala**, cada um em seu próprio idioma:

```json
{
  "type": "transcription",
  "utteranceId": "msg-001",
  "speakerId": "alice",
  "roomId": "vr-room",
  "originalLanguage": "pt-BR",
  "targetLanguage": "en-US",
  "text": "Hello, how are you?"
}
```

**Campos:**
- `type`: sempre "transcription"
- `utteranceId`: rastreamento da mensagem original
- `speakerId`: quem falou
- `roomId`: sala onde foi enviada
- `originalLanguage`: idioma de origem
- `targetLanguage`: idioma para o qual foi traduzida
- `text`: texto traduzido

**Comportamento por idioma:**

| Cliente       | originalLanguage | targetLanguage | Texto recebido         |
|---------------|------------------|----------------|------------------------|
| Alice (pt-BR) | pt-BR            | pt-BR          | Olá, tudo bem?        |
| Bob (en-US)   | pt-BR            | en-US          | Hello, how are you?   |
| Carlos (es-ES)| pt-BR            | es-ES          | ¿Hola, cómo estás?    |

---

#### **Mensagem ERROR (erro do servidor)**

```json
{
  "type": "error",
  "message": "Chave Azure inválida"
}
```

**Causas comuns:**
- `AZURE_TRANSLATOR_KEY` inválida
- `AZURE_TRANSLATOR_REGION` incorreta
- Servidor desconectado
- Mensagem com formato inválido

---

## 🔄 Fluxo Completo de Tradução

### **Cenário: 3 jogadores em sala, idiomas diferentes**

**Estado inicial:**
```
Sala: "vr-game-session"

Alice (clientId: alice, language: pt-BR) - Conectada ✅
Bob (clientId: bob, language: en-US) - Conectado ✅
Carlos (clientId: carlos, language: es-ES) - Conectado ✅
```

**Ação 1: Alice entra na sala**

```json
// Alice envia
{
  "type": "join",
  "clientId": "alice",
  "roomId": "vr-game-session",
  "language": "pt-BR"
}

// Servidor registra na Map
clients.set(wsAlice, {
  clientId: "alice",
  roomId: "vr-game-session",
  language: "pt-BR"
})
```

**Ação 2: Bob entra na sala**

```json
// Bob envia
{
  "type": "join",
  "clientId": "bob",
  "roomId": "vr-game-session",
  "language": "en-US"
}
```

**Ação 3: Alice fala**

```
// Alice envia string simples (compatibilidade)
"Boa noite, pessoal!"

// Servidor converte
{
  "type": "utterance",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",
  "roomId": "vr-game-session",
  "language": "pt-BR",
  "text": "Boa noite, pessoal!"
}
```

**Ação 4: Servidor processa**

```javascript
// 1. Identifica clientes na sala "vr-game-session"
clientesNaSala = [
  {ws: wsAlice, data: {clientId: "alice", language: "pt-BR"}},
  {ws: wsBob, data: {clientId: "bob", language: "en-US"}},
  {ws: wsCarlos, data: {clientId: "carlos", language: "es-ES"}}
]

// 2. Para cada cliente, traduz se idioma diferente
```

**Ação 5: Servidor envia para Alice (sem tradução)**

```json
{
  "type": "transcription",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",
  "roomId": "vr-game-session",
  "originalLanguage": "pt-BR",
  "targetLanguage": "pt-BR",
  "text": "Boa noite, pessoal!"
}

// Alice vê no balão: "Boa noite, pessoal!"
```

**Ação 6: Servidor traduz para Bob (pt-BR → en-US)**

```
Request Azure:
  from: pt-BR
  to: en-US
  text: "Boa noite, pessoal!"

Response Azure:
  "Good evening, everyone!"

Servidor envia para Bob:
{
  "type": "transcription",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",
  "roomId": "vr-game-session",
  "originalLanguage": "pt-BR",
  "targetLanguage": "en-US",
  "text": "Good evening, everyone!"
}

// Bob vê no balão: "Good evening, everyone!"
```

**Ação 7: Servidor traduz para Carlos (pt-BR → es-ES)**

```
Request Azure:
  from: pt-BR
  to: es-ES
  text: "Boa noite, pessoal!"

Response Azure:
  "¡Buenas noches, todos!"

Servidor envia para Carlos:
{
  "type": "transcription",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",
  "roomId": "vr-game-session",
  "originalLanguage": "pt-BR",
  "targetLanguage": "es-ES",
  "text": "¡Buenas noches, todos!"
}

// Carlos vê no balão: "¡Buenas noches, todos!"
```

**Resultado final:**

Todos os 3 jogadores veem a mensagem de Alice em seu próprio idioma! 🌍

---

## 🎮 Integração com Unity

### **Setup básico no Unity:**

```csharp
// 1. Conectar ao servidor
TranslationWebSocketClient ws = new TranslationWebSocketClient();
await ws.ConnectAsync("ws://192.168.1.100:8080");

// 2. Fazer JOIN (OBRIGATÓRIO!)
string joinJson = JsonUtility.ToJson(new {
    type = "join",
    clientId = "alice",
    roomId = "vr-game-session",
    language = "pt-BR"
});
ws.SendString(joinJson);

// 3. Enviar mensagem (pode ser string simples!)
ws.SendString("Olá, pessoal!");

// 4. Receber tradução
ws.OnMessage += (json) => {
    var msg = JsonUtility.FromJson<ServerMessage>(json);
    if (msg.type == "transcription") {
        Debug.Log($"{msg.speakerId}: {msg.text}");
        // Exibir no balão 3D
        chatBubble.Show(msg.text);
    }
};
```

### **Estrutura C# (ServerMessage.cs):**

```csharp
[Serializable]
public class ServerMessage
{
    public string type;              // "transcription" ou "error"
    public string utteranceId;       // ID único
    public string speakerId;         // Quem falou
    public string roomId;            // Sala
    public string originalLanguage;  // pt-BR
    public string targetLanguage;    // en-US
    public string text;              // Texto traduzido
    public string message;           // (para errors)
}
```

---

## 🌐 Deploy (Acesso Externo)

### **Descobrir IP do servidor:**
```bash
hostname -I | awk '{print $1}'
# Exemplo: 192.168.1.100
```

### **Abrir porta no firewall:**
```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

### **No Unity:**
```csharp
// Trocar localhost por IP real
string serverUrl = "ws://192.168.1.100:8080";
```

### **Deploy em Railway (cloud):**

1. Criar conta em https://railway.app
2. Conectar repositório GitHub
3. Adicionar variáveis de ambiente (Azure keys)
4. Deploy automático

URL será: `wss://seu-app.up.railway.app`

---

## 📊 Monitoramento

### **Ver logs em tempo real:**
```bash
pm2 logs translation-server
```

### **Ver status:**
```bash
pm2 status
```

### **Logs importantes:**

```
Client connected                                    # Nova conexão
alice entrou na sala vr-game-session (pt-BR)       # JOIN bem-sucedido
📝 Received plain text: "Olá"                      # String recebida
🔄 Converted to utterance: {...}                   # Conversão automática
Translation: pt-BR → en-US: "Olá" → "Hello"        # Tradução Azure
```

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| "address already in use" | `pm2 stop translation-server` ou `killall node` |
| Azure não traduz | Verificar `AZURE_TRANSLATOR_KEY` e `AZURE_TRANSLATOR_REGION` |
| Unity não recebe mensagens | Fazer JOIN antes de enviar utterances |
| WebSocket não conecta | Confirmar URL `ws://` e porta 8080 aberta |
| Mensagens não chegam a sala | Verificar que `roomId` é o mesmo para todos |

---

## 📚 Documentação Adicional

- **[SERVER_DOCUMENTATION.md](./SERVER_DOCUMENTATION.md)** - Documentação técnica detalhada
- **[DOCUMENTACAO.md](./DOCUMENTACAO.md)** - Arquitetura do sistema
- **[CHAT_CLIENT.md](./CHAT_CLIENT.md)** - Cliente C# de chat

---

## 🛠️ Stack Tecnológico

- **Node.js** v16+
- **WebSocket** (biblioteca `ws`)
- **HTTP Client** (biblioteca `axios`)
- **Variáveis de Ambiente** (biblioteca `dotenv`)
- **Azure Translator API** v3.0
- **Unity** 2022.3.48f1 (compatível com versões anteriores)

---

## 🚀 Roadmap

- [ ] Histórico de chat persistente
- [ ] Indicador de "digitando"
- [ ] Compressão de áudio
- [ ] Cache de traduções
- [ ] Autenticação de clientes
- [ ] Rate limiting
- [ ] Suporte a múltiplas regiões Azure

---

## 📝 Resumo

✅ **Servidor WebSocket** para comunicação multilíngue em tempo real  
✅ **Tradução automática** via Azure Translator para 100+ idiomas  
✅ **Sistema de salas** para isolar conversas  
✅ **Compatível com Unity VR** (Meta Quest, SteamVR)  
✅ **Suporta strings simples** e JSON estruturado  
✅ **Pronto para produção** com PM2 e deploy em cloud  

---

**Versão:** 1.0  
**Última atualização:** Novembro 2025  
**Status:** ✅ Produção  
**Suporte:** Anthony Dev Team
