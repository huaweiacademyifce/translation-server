# Padrão de Mensagens - Unity ↔ Servidor WebSocket

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Fluxo de Conexão](#fluxo-de-conexão)
3. [Mensagens Unity → Servidor](#mensagens-unity--servidor)
4. [Mensagens Servidor → Unity](#mensagens-servidor--unity)
5. [Ciclo Completo](#ciclo-completo-de-troca-de-mensagens)
6. [Exemplos de Código](#exemplos-de-código)
7. [Tratamento de Erros](#tratamento-de-erros)
8. [Boas Práticas](#boas-práticas)

---

## 👀 Visão Geral

A comunicação entre **Unity** e o **servidor Node.js** segue um padrão JSON estruturado onde:

- **Unity envia** dois tipos de mensagens: `JOIN` e `UTTERANCE`
- **Servidor responde** com: `TRANSCRIPTION` e `ERROR`
- **Todas as mensagens** são trocadas via WebSocket (texto em JSON)
- **Compatibilidade**: Servidor também aceita strings simples

```
┌────────────────────────┐                ┌──────────────────────┐
│     Unity Client       │                │  Node.js Server      │
│                        │                │                      │
│  1. Conectar ──────────┼────────────────┼─→ Aceitar conexão   │
│                        │                │                      │
│  2. JOIN ─────────────┼────────────────┼─→ Registrar cliente │
│                        │                │                      │
│  3. UTTERANCE ────────┼────────────────┼─→ Traduzir          │
│                        │                │                      │
│  4. Receber ←─────────┼────────────────┼─ TRANSCRIPTION      │
│     TRANSCRIPTION      │                │                      │
│                        │                │                      │
└────────────────────────┘                └──────────────────────┘
```

---

## 🔌 Fluxo de Conexão

### **1. WebSocket Connect (Cliente → Servidor)**

```javascript
// Unity C#
using System.Net.WebSockets;

var ws = new ClientWebSocket();
await ws.ConnectAsync(new Uri("ws://192.168.1.100:8080"), CancellationToken.None);
```

### **Servidor recebe:**
```
[WebSocket] Client connected
```

### **2. Connection Handshake**

O servidor **NÃO envia confirmação explícita**, mas está pronto para receber mensagens.

---

## 📤 Mensagens Unity → Servidor

### **Tipo 1: JOIN (Obrigatório - Primeiro Envio)**

**Propósito:** Registrar o cliente no servidor e salvar sua metadata (clientId, roomId, language)

**Formato JSON:**
```json
{
  "type": "join",
  "clientId": "alice",
  "roomId": "vr-game-session",
  "language": "pt-BR"
}
```

**Campos obrigatórios:**
| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `type` | string | Sempre "join" | `"join"` |
| `clientId` | string | ID único do jogador | `"alice"`, `"player-1"` |
| `roomId` | string | ID da sala/sessão | `"room-1"`, `"vr-game-session"` |
| `language` | string | Idioma do cliente (BCP 47) | `"pt-BR"`, `"en-US"` |

**Quando enviar:**
- ✅ Na conexão inicial (OBRIGATÓRIO)
- ✅ Ao trocar de sala
- ✅ Ao trocar de idioma

**Exemplo em C#:**
```csharp
public void JoinRoom(string clientId, string roomId, string language)
{
    var joinMessage = new {
        type = "join",
        clientId = clientId,
        roomId = roomId,
        language = language
    };
    
    string json = JsonUtility.ToJson(joinMessage);
    SendMessage(json);
    
    Debug.Log($"✅ Joined room: {roomId} as {clientId} ({language})");
}
```

**Servidor processa:**
```javascript
// src/websocket.js - handleJoin()
clients.set(ws, {
    clientId: "alice",
    roomId: "vr-game-session",
    language: "pt-BR"
});
console.log("alice entrou na sala vr-game-session (pt-BR)");
```

---

### **Tipo 2: UTTERANCE (Mensagem Principal)**

**Propósito:** Enviar uma mensagem para tradução e broadcast

**Formato JSON (Completo):**
```json
{
  "type": "utterance",
  "utteranceId": "msg-001",
  "speakerId": "alice",
  "roomId": "vr-game-session",
  "language": "pt-BR",
  "text": "Olá, tudo bem?"
}
```

**Campos obrigatórios:**
| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `type` | string | Sempre "utterance" | `"utterance"` |
| `speakerId` | string | ID do jogador (mesmo do join) | `"alice"` |
| `roomId` | string | Sala (mesmo do join) | `"vr-game-session"` |
| `language` | string | Idioma (mesmo do join) | `"pt-BR"` |
| `text` | string | Texto a traduzir | `"Olá, tudo bem?"` |

**Campos opcionais:**
| Campo | Tipo | Descrição | Padrão |
|-------|------|-----------|--------|
| `utteranceId` | string | ID único para rastrear | Gerado pelo servidor |

**Exemplo em C#:**
```csharp
public void SendMessage(string text)
{
    var message = new {
        type = "utterance",
        utteranceId = System.Guid.NewGuid().ToString(),
        speakerId = clientId,
        roomId = roomId,
        language = language,
        text = text
    };
    
    string json = JsonUtility.ToJson(message);
    SendMessage(json);
    
    Debug.Log($"📤 Sent: {text}");
}
```

---

### **Tipo 2b: UTTERANCE (String Simples - Compatibilidade)**

**Propósito:** Envio direto de texto simples (sem JSON)

**Formato:**
```
Olá, tudo bem?
```

**O servidor converte automaticamente para:**
```json
{
  "type": "utterance",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",           // ← do JOIN anterior
  "roomId": "vr-game-session",    // ← do JOIN anterior
  "language": "pt-BR",            // ← do JOIN anterior
  "text": "Olá, tudo bem?"        // ← a string recebida
}
```

**Quando usar:**
- ✅ Compatibilidade com `TranslationWebSocketClient.SendString()`
- ✅ Prototipagem rápida
- ✅ Clientes legados que não montam JSON

**Exemplo em C#:**
```csharp
// Envio direto (string simples)
ws.SendString("Olá, tudo bem?");

// vs JSON estruturado
ws.SendString(JsonUtility.ToJson(new {
    type = "utterance",
    speakerId = "alice",
    roomId = "vr-game-session",
    language = "pt-BR",
    text = "Olá, tudo bem?"
}));
```

---

## 📥 Mensagens Servidor → Unity

### **Tipo 1: TRANSCRIPTION (Resposta Principal)**

**Propósito:** Enviar mensagem traduzida para todos os clientes da sala

**Formato:**
```json
{
  "type": "transcription",
  "utteranceId": "msg-001",
  "speakerId": "alice",
  "roomId": "vr-game-session",
  "originalLanguage": "pt-BR",
  "targetLanguage": "en-US",
  "text": "Hello, how are you?"
}
```

**Campos:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | string | Sempre "transcription" |
| `utteranceId` | string | ID da mensagem original |
| `speakerId` | string | Quem enviou |
| `roomId` | string | Sala onde foi enviada |
| `originalLanguage` | string | Idioma de origem |
| `targetLanguage` | string | Idioma de destino |
| `text` | string | Texto traduzido |

**Comportamento especial:**

Cada cliente na sala recebe a **MESMA mensagem com idiomas diferentes**:

```
Mensagem original de Alice: "Olá, tudo bem?"
Idioma: pt-BR

┌─────────────────────────────────────────────────────────┐
│              Servidor envia para cada cliente             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Para Alice (pt-BR):                                     │
│  {                                                        │
│    "type": "transcription",                             │
│    "speakerId": "alice",                                │
│    "originalLanguage": "pt-BR",                         │
│    "targetLanguage": "pt-BR",    ← Mesmo idioma        │
│    "text": "Olá, tudo bem?"      ← Texto original      │
│  }                                                        │
│                                                           │
│  Para Bob (en-US):                                       │
│  {                                                        │
│    "type": "transcription",                             │
│    "speakerId": "alice",                                │
│    "originalLanguage": "pt-BR",                         │
│    "targetLanguage": "en-US",    ← Idioma do Bob       │
│    "text": "Hello, how are you?"  ← Traduzido          │
│  }                                                        │
│                                                           │
│  Para Carlos (es-ES):                                    │
│  {                                                        │
│    "type": "transcription",                             │
│    "speakerId": "alice",                                │
│    "originalLanguage": "pt-BR",                         │
│    "targetLanguage": "es-ES",    ← Idioma do Carlos   │
│    "text": "¿Hola, cómo estás?"   ← Traduzido         │
│  }                                                        │
└─────────────────────────────────────────────────────────┘
```

**Processamento em C#:**
```csharp
[Serializable]
public class TranscriptionMessage
{
    public string type;
    public string utteranceId;
    public string speakerId;
    public string roomId;
    public string originalLanguage;
    public string targetLanguage;
    public string text;
}

// Receber e processar
ws.OnMessage += (json) => {
    var msg = JsonUtility.FromJson<TranscriptionMessage>(json);
    
    if (msg.type == "transcription")
    {
        Debug.Log($"[{msg.speakerId}] {msg.text}");
        
        // Filtrar se for apenas own messages
        if (msg.speakerId != myClientId)
        {
            chatBubble.Show(msg.speakerId, msg.text);
        }
    }
};
```

---

### **Tipo 2: ERROR (Mensagem de Erro)**

**Propósito:** Notificar cliente sobre erro

**Formato:**
```json
{
  "type": "error",
  "message": "AZURE_TRANSLATOR_KEY inválida"
}
```

**Campos:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | string | Sempre "error" |
| `message` | string | Descrição do erro |

**Erros comuns:**
| Erro | Causa |
|------|-------|
| "AZURE_TRANSLATOR_KEY inválida" | Chave Azure vencida ou errada |
| "AZURE_TRANSLATOR_REGION incorreta" | Região configurada errada |
| "Invalid message format" | JSON malformado ou erro no parse |
| "Translation service unavailable" | Azure API fora do ar |

**Tratamento em C#:**
```csharp
ws.OnMessage += (json) => {
    var msg = JsonUtility.FromJson<dynamic>(json);
    
    if (msg.type == "error")
    {
        Debug.LogError($"❌ Servidor erro: {msg.message}");
        // Mostrar UI de erro para usuário
    }
};
```

---

## 🔄 Ciclo Completo de Troca de Mensagens

### **Cenário: Alice e Bob em sala, idiomas diferentes**

#### **Timeline:**

```
Tempo    | Alice (pt-BR)           | Bob (en-US)           | Servidor
---------|-------------------------|----------------------|----------------------------------
T0       | WebSocket.Connect()     |                       | ✅ Aceita Alice
T1       | Enviar JOIN             |                       | 📝 Registra Alice
T2       |                         | WebSocket.Connect()   | ✅ Aceita Bob
T3       |                         | Enviar JOIN           | 📝 Registra Bob
T4       | Enviar UTTERANCE        |                       |
         | "Oi, tudo bem?"         |                       | 🔄 Processa
T5       |                         |                       | 📊 Traduz para en-US
T6       | ← Recebe TRANSCRIPTION  | ← Recebe TRANSCRIPTION| ✅ Broadcast
         | (pt-BR→pt-BR)           | (pt-BR→en-US)         |
         | "Oi, tudo bem?"         | "Hi, how are you?"    |
T7       | Exibir balão: "Oi..."   | Exibir balão: "Hi.."  |
```

---

### **Passo a passo detalhado:**

#### **1️⃣ Alice conecta**

```c#
// Unity - Alice
ws.ConnectAsync(new Uri("ws://192.168.1.100:8080"), token);
```

```javascript
// Node.js
[WebSocket] Client connected
```

---

#### **2️⃣ Alice faz JOIN**

```json
// Unity envia
{
  "type": "join",
  "clientId": "alice",
  "roomId": "game-room",
  "language": "pt-BR"
}
```

```javascript
// Node.js processa
clients.set(wsAlice, {
  clientId: "alice",
  roomId: "game-room",
  language: "pt-BR"
});
console.log("✅ alice entrou na sala game-room (pt-BR)");
```

---

#### **3️⃣ Bob conecta**

```c#
// Unity - Bob
ws.ConnectAsync(new Uri("ws://192.168.1.100:8080"), token);
```

```javascript
// Node.js
[WebSocket] Client connected
```

---

#### **4️⃣ Bob faz JOIN**

```json
// Unity envia
{
  "type": "join",
  "clientId": "bob",
  "roomId": "game-room",
  "language": "en-US"
}
```

```javascript
// Node.js processa
clients.set(wsBob, {
  clientId: "bob",
  roomId: "game-room",
  language: "en-US"
});
console.log("✅ bob entrou na sala game-room (en-US)");
```

---

#### **5️⃣ Alice envia mensagem**

```json
// Unity - Alice envia string simples
"Oi, tudo bem?"
```

```javascript
// Node.js recebe string e converte
{
  "type": "utterance",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",
  "roomId": "game-room",
  "language": "pt-BR",
  "text": "Oi, tudo bem?"
}
```

---

#### **6️⃣ Servidor processa**

```javascript
// Node.js - websocket.js / handleUtterance()

// 1. Identifica clientes na sala
const roomClients = getRoomClients("game-room", clients);
// Resultado: [
//   {ws: wsAlice, data: {clientId: "alice", language: "pt-BR"}},
//   {ws: wsBob, data: {clientId: "bob", language: "en-US"}}
// ]

// 2. Manda para cada cliente
for (const [clientWs, clientData] of roomClients) {
    const toLang = clientData.language;
    
    // Traduz se idioma diferente
    let text = "Oi, tudo bem?";
    if ("pt-BR" !== toLang) {
        text = await translateText({
            text: "Oi, tudo bem?",
            from: "pt-BR",
            to: toLang
        });
        // Request Azure → "Hi, how are you?"
    }
    
    clientWs.send({
        type: "transcription",
        speakerId: "alice",
        originalLanguage: "pt-BR",
        targetLanguage: toLang,
        text: text
    });
}
```

---

#### **7️⃣ Alice recebe (sem tradução)**

```json
// Unity - Alice recebe
{
  "type": "transcription",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",
  "roomId": "game-room",
  "originalLanguage": "pt-BR",
  "targetLanguage": "pt-BR",
  "text": "Oi, tudo bem?"
}
```

```csharp
// Exibir no balão: "Oi, tudo bem?"
chatBubble.Show("alice", "Oi, tudo bem?");
```

---

#### **8️⃣ Bob recebe (traduzido)**

```json
// Unity - Bob recebe
{
  "type": "transcription",
  "utteranceId": "msg-1764268423178",
  "speakerId": "alice",
  "roomId": "game-room",
  "originalLanguage": "pt-BR",
  "targetLanguage": "en-US",
  "text": "Hi, how are you?"
}
```

```csharp
// Exibir no balão: "Hi, how are you?"
chatBubble.Show("alice", "Hi, how are you?");
```

---

## 💻 Exemplos de Código

### **Exemplo 1: Cliente C# Completo**

```csharp
using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

public class SimpleTranslationClient : MonoBehaviour
{
    private ClientWebSocket ws;
    private CancellationTokenSource cts;
    
    public async void Start()
    {
        ws = new ClientWebSocket();
        cts = new CancellationTokenSource();
        
        // Conectar
        await ws.ConnectAsync(
            new Uri("ws://192.168.1.100:8080"), 
            cts.Token
        );
        Debug.Log("✅ Conectado");
        
        // Fazer JOIN
        await SendMessageAsync(new {
            type = "join",
            clientId = "alice",
            roomId = "game-room",
            language = "pt-BR"
        });
        
        // Iniciar loop de recepção
        _ = ReceiveLoop();
    }
    
    public async Task SendMessageAsync(object message)
    {
        string json = JsonUtility.ToJson(message);
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(
            new ArraySegment<byte>(bytes),
            WebSocketMessageType.Text,
            true,
            cts.Token
        );
    }
    
    private async Task ReceiveLoop()
    {
        byte[] buffer = new byte[4096];
        
        while (ws.State == WebSocketState.Open)
        {
            var result = await ws.ReceiveAsync(
                new ArraySegment<byte>(buffer),
                cts.Token
            );
            
            string json = Encoding.UTF8.GetString(
                buffer, 0, result.Count
            );
            
            HandleMessage(json);
        }
    }
    
    private void HandleMessage(string json)
    {
        var msg = JsonUtility.FromJson<dynamic>(json);
        
        if (msg.type == "transcription")
        {
            Debug.Log($"💬 {msg.speakerId}: {msg.text}");
        }
        else if (msg.type == "error")
        {
            Debug.LogError($"❌ {msg.message}");
        }
    }
}
```

---

### **Exemplo 2: Enviar Texto Simples**

```csharp
// String simples (compatibilidade)
byte[] bytes = Encoding.UTF8.GetBytes("Olá, tudo bem?");
await ws.SendAsync(
    new ArraySegment<byte>(bytes),
    WebSocketMessageType.Text,
    true,
    token
);
```

---

### **Exemplo 3: Processar Resposta**

```csharp
[Serializable]
public class ServerMessage
{
    public string type;
    public string speakerId;
    public string text;
    public string originalLanguage;
    public string targetLanguage;
    public string message; // para errors
}

// Processar
var msg = JsonUtility.FromJson<ServerMessage>(json);

if (msg.type == "transcription")
{
    // Exibir no UI
    uiText.text = $"{msg.speakerId}: {msg.text}";
}
```

---

## ⚠️ Tratamento de Erros

### **Erro 1: JOIN não enviado**

```
❌ Problema: Enviar UTTERANCE sem fazer JOIN antes
```

**Comportamento:**
- Servidor usará valores padrão
- `speakerId: "unknown"`
- `roomId: "default-room"`

**Solução:**
```csharp
// SEMPRE fazer JOIN primeiro
await SendJoin("alice", "game-room", "pt-BR");

// DEPOIS enviar mensagens
await SendUtterance("Olá!");
```

---

### **Erro 2: roomId incorreto**

```json
// Alice na sala "room-1"
{
  "type": "join",
  "clientId": "alice",
  "roomId": "room-1",    // ← Aqui
  "language": "pt-BR"
}

// Bob na sala "room-2"
{
  "type": "join",
  "clientId": "bob",
  "roomId": "room-2",    // ← Diferente!
  "language": "en-US"
}

// Resultado: Alice e Bob NÃO recebem mensagens um do outro
```

**Solução:** Usar mesmo `roomId`

---

### **Erro 3: idioma inválido**

```json
// ❌ Errado
{
  "language": "Portuguese"  // Não é BCP 47
}

// ✅ Correto
{
  "language": "pt-BR"  // BCP 47
}
```

**Idiomas válidos:**
- `pt-BR` - Português Brasil
- `pt-PT` - Português Portugal
- `en-US` - Inglês EUA
- `en-GB` - Inglês UK
- `es-ES` - Espanhol Espanha
- `es-MX` - Espanhol México
- `fr-FR` - Francês
- `de-DE` - Alemão
- `ja-JP` - Japonês
- `zh-CN` - Chinês Simplificado
- ... e 100+ outros

---

### **Erro 4: Azure inválido**

```
❌ AZURE_TRANSLATOR_KEY inválida
❌ AZURE_TRANSLATOR_REGION incorreta
```

**Solução:**
```bash
# Verificar .env
cat .env

# Regener chave no Azure portal
# portal.azure.com → Translator → Regenerar chave
```

---

## ✅ Boas Práticas

### **1. Sempre fazer JOIN no início**

```csharp
// ✅ Correto
public async void OnConnected()
{
    await SendJoin("player-1", "room-1", "pt-BR");
    // Agora pode enviar mensagens
}

// ❌ Errado
public async void OnConnected()
{
    await SendUtterance("Olá!");  // Sem JOIN
}
```

---

### **2. Usar clientId único por jogador**

```csharp
// ✅ Correto
string clientId = System.Guid.NewGuid().ToString();
// ou
string clientId = Networking.LocalClientId.ToString(); // Netcode

// ❌ Errado
string clientId = "player";  // Não único
```

---

### **3. Salvar roomId para referência**

```csharp
public class TranslationManager : MonoBehaviour
{
    private string currentRoomId;
    private string currentLanguage;
    
    public async void JoinRoom(string roomId, string language)
    {
        currentRoomId = roomId;
        currentLanguage = language;
        
        await SendJoin("player-1", roomId, language);
    }
    
    public async void SendMessage(string text)
    {
        await SendUtterance(text, currentRoomId, currentLanguage);
    }
}
```

---

### **4. Implementar reconexão**

```csharp
private async Task ReconnectLoop()
{
    while (true)
    {
        try
        {
            if (ws.State != WebSocketState.Open)
            {
                await ws.ConnectAsync(serverUri, cts.Token);
                await SendJoin(clientId, roomId, language);
            }
        }
        catch
        {
            await Task.Delay(5000); // Tentar em 5s
        }
    }
}
```

---

### **5. Filtrar mensagens próprias (opcional)**

```csharp
private void HandleMessage(string json)
{
    var msg = JsonUtility.FromJson<ServerMessage>(json);
    
    if (msg.type == "transcription")
    {
        // Não exibir próprias mensagens (já mostra ao digitar)
        if (msg.speakerId != myClientId)
        {
            chatBubble.Show(msg.speakerId, msg.text);
        }
    }
}
```

---

### **6. Usar try-catch em JSON.Parse**

```csharp
private void HandleMessage(string json)
{
    try
    {
        var msg = JsonUtility.FromJson<ServerMessage>(json);
        ProcessMessage(msg);
    }
    catch (Exception ex)
    {
        Debug.LogError($"Erro parseando JSON: {ex.Message}\n{json}");
    }
}
```

---

## 📊 Resumo de Mensagens

### **Tabela Rápida**

| De | Para | Tipo | Descrição |
|----|------|------|-----------|
| Unity | Servidor | JOIN | Registrar cliente |
| Unity | Servidor | UTTERANCE | Enviar mensagem |
| Servidor | Unity | TRANSCRIPTION | Mensagem traduzida |
| Servidor | Unity | ERROR | Notificar erro |

### **Fluxo Mínimo**

```
1. WebSocket Connect
2. JOIN
3. UTTERANCE
4. ← TRANSCRIPTION
```

---

**Versão:** 1.0  
**Última atualização:** Novembro 2025  
**Compatibilidade:** Unity 2020.3+, C# 7.3+
