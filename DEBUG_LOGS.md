# Guia de Logs de Debug - Translation Server

## 📊 Entendendo os Logs do Servidor

Todos os logs do servidor foram adicionados para rastrear **exatamente** o que está acontecendo em cada etapa:

1. ✅ **Conexão de cliente**
2. 📨 **Recebimento de mensagens**
3. ⚙️ **Processamento** (JOIN/UTTERANCE)
4. 🌐 **Tradução com Azure**
5. 📤 **Envio para clientes**

---

## 🎬 Cenário Completo: 2 Jogadores em Salas

### **Timeline:**

```
Jogador A (pt-BR)          Jogador B (en-US)          Servidor Node.js
     │                            │                           │
     │ ─────── WebSocket Connect ─│─────────────────────────> │
     │                            │                           │
     │                            │ ◄─ WebSocket Connect ─────│
     │                            │                           │
     │ ───── JSON JOIN (A) ──────────────────────────────────> │
     │                            │                    [Logs de JOIN A]
     │                            │                           │
     │                            │ ──── JSON JOIN (B) ──────> │
     │                            │                    [Logs de JOIN B]
     │                            │                           │
     │ ─── JSON UTTERANCE (A) ───────────────────────────────> │
     │                            │                  [Logs de UTTERANCE]
     │                            │                  [Azure Tradução]
     │ ◄─ TRANSCRIPTION (pt-BR) ──│◄────────────────────────── │
     │                            │                           │
     │                            │ ◄──TRANSCRIPTION (en-US)── │
```

---

## 📋 Exemplo Completo de Logs

### **1. Servidor Iniciando**

```
================================================================================
🚀 [14:32:15] SERVIDOR WEBSOCKET INICIADO
================================================================================
🌐 URL: ws://localhost:8080
🌐 URL (Rede local): ws://[SEU_IP]:8080
📊 Porta: 8080
================================================================================

```

### **2. Jogador A Conecta (pt-BR)**

```
================================================================================
✅ [14:32:18] CONEXÃO #1 ACEITA
================================================================================
📊 Total de clientes conectados: 1

```

### **3. Jogador A Envia JOIN**

```
────────────────────────────────────────────────────────────────────────────
📨 [14:32:19] MENSAGEM RECEBIDA (Conexão #1)
────────────────────────────────────────────────────────────────────────────
📦 Dados brutos: {"type":"join","clientId":"alice","roomId":"game-room","language":"pt-BR"}
📏 Tamanho: 89 bytes
✅ JSON válido detectado
📋 Tipo de mensagem: join
📋 Conteúdo:
{
  "type": "join",
  "clientId": "alice",
  "roomId": "game-room",
  "language": "pt-BR"
}

🔀 ROTEANDO PARA HANDLER...

────────────────────────────────────────────────────────────────────────────
⚙️  [14:32:19] PROCESSANDO MENSAGEM (Conn #1)
────────────────────────────────────────────────────────────────────────────
📋 Tipo: join

✅ [14:32:19] PROCESSADOR: JOIN
────────────────────────────────────────────────────────────────────────────
👤 Cliente ID: alice
🏠 Sala: game-room
🗣️  Idioma: pt-BR
📊 Clientes na sala "game-room": 1
📝 Idiomas na sala: pt-BR

📤 Enviando confirmação de JOIN:
{
  "type": "joined",
  "clientId": "alice",
  "roomId": "game-room"
}

✅ JOIN PROCESSADO COM SUCESSO

```

### **4. Jogador B Conecta (en-US)**

```
================================================================================
✅ [14:32:25] CONEXÃO #2 ACEITA
================================================================================
📊 Total de clientes conectados: 2

```

### **5. Jogador B Envia JOIN**

```
────────────────────────────────────────────────────────────────────────────
📨 [14:32:26] MENSAGEM RECEBIDA (Conexão #2)
────────────────────────────────────────────────────────────────────────────
📦 Dados brutos: {"type":"join","clientId":"bob","roomId":"game-room","language":"en-US"}
📏 Tamanho: 87 bytes
✅ JSON válido detectado
📋 Tipo de mensagem: join
📋 Conteúdo:
{
  "type": "join",
  "clientId": "bob",
  "roomId": "game-room",
  "language": "en-US"
}

🔀 ROTEANDO PARA HANDLER...

────────────────────────────────────────────────────────────────────────────
⚙️  [14:32:26] PROCESSANDO MENSAGEM (Conn #2)
────────────────────────────────────────────────────────────────────────────
📋 Tipo: join

✅ [14:32:26] PROCESSADOR: JOIN
────────────────────────────────────────────────────────────────────────────
👤 Cliente ID: bob
🏠 Sala: game-room
🗣️  Idioma: en-US
📊 Clientes na sala "game-room": 2
📝 Idiomas na sala: pt-BR, en-US

📤 Enviando confirmação de JOIN:
{
  "type": "joined",
  "clientId": "bob",
  "roomId": "game-room"
}

✅ JOIN PROCESSADO COM SUCESSO

```

### **6. Jogador A Envia Mensagem**

```
────────────────────────────────────────────────────────────────────────────
📨 [14:32:35] MENSAGEM RECEBIDA (Conexão #1)
────────────────────────────────────────────────────────────────────────────
📦 Dados brutos: {"type":"utterance","utteranceId":"msg-123","speakerId":"alice","roomId":"game-room","language":"pt-BR","text":"Oi, tudo bem?"}
📏 Tamanho: 135 bytes
✅ JSON válido detectado
📋 Tipo de mensagem: utterance
📋 Conteúdo:
{
  "type": "utterance",
  "utteranceId": "msg-123",
  "speakerId": "alice",
  "roomId": "game-room",
  "language": "pt-BR",
  "text": "Oi, tudo bem?"
}

🔀 ROTEANDO PARA HANDLER...

────────────────────────────────────────────────────────────────────────────
⚙️  [14:32:35] PROCESSANDO MENSAGEM (Conn #1)
────────────────────────────────────────────────────────────────────────────
📋 Tipo: utterance

✅ [14:32:35] PROCESSADOR: UTTERANCE
────────────────────────────────────────────────────────────────────────────
👤 Falante: alice
🏠 Sala: game-room
🗣️  Idioma: pt-BR
📝 Texto: "Oi, tudo bem?"
🆔 ID da mensagem: msg-123

📊 Clientes na sala "game-room": 2
🔄 ENVIANDO PARA CADA CLIENTE NA SALA:

  [1/2] Cliente: alice
      Idioma: pt-BR
      Tradução necessária: NÃO
      pt-BR → pt-BR
      ℹ️  Usando texto original (mesmo idioma)
      📦 Enviando payload:
      {"type":"transcription","utteranceId":"msg-123","speakerId":"alice","roomId":"game-room","originalLanguage":"pt-BR","targetLanguage":"pt-BR","text":"Oi, tudo bem?"}
      ✅ Enviado com sucesso

  [2/2] Cliente: bob
      Idioma: en-US
      Tradução necessária: SIM
      pt-BR → en-US
      🔄 Traduzindo...

    🌐 REQUISIÇÃO AZURE TRANSLATOR
    URL: https://api.cognitive.microsofttranslator.com/translate
    De: pt-BR → Para: en-US
    Texto: "Oi, tudo bem?"

    ✅ TRADUÇÃO RECEBIDA: "Hi, how are you?"
      ✅ Tradução: "Hi, how are you?"
      📦 Enviando payload:
      {"type":"transcription","utteranceId":"msg-123","speakerId":"alice","roomId":"game-room","originalLanguage":"pt-BR","targetLanguage":"en-US","text":"Hi, how are you?"}
      ✅ Enviado com sucesso

✅ UTTERANCE PROCESSADO COM SUCESSO

```

### **7. Desconexão de Jogador**

```
================================================================================
❌ [14:33:00] CONEXÃO #1 FECHADA
   Cliente: alice
   Sala: game-room
   Idioma: pt-BR
📊 Clientes restantes: 1
================================================================================

```

---

## 🔍 Interpretando os Logs

### **✅ Conexão bem-sucedida:**
```
✅ [HH:MM:SS] CONEXÃO #1 ACEITA
📊 Total de clientes conectados: 1
```
→ Cliente conectou ao WebSocket com sucesso

---

### **⚠️ Mensagem como string simples:**
```
⚠️  Não é JSON, detectado como string simples
📝 Texto recebido: "Olá"
🔄 CONVERSÃO AUTOMÁTICA (Compatibilidade)
```
→ Cliente enviou texto puro, servidor converteu automaticamente

---

### **🌐 Tradução bem-sucedida:**
```
🔄 Traduzindo...
🌐 REQUISIÇÃO AZURE TRANSLATOR
De: pt-BR → Para: en-US
✅ TRADUÇÃO RECEBIDA: "Hi, how are you?"
```
→ Azure traduziu corretamente

---

### **❌ Erro na tradução:**
```
🔄 Traduzindo...
❌ ERRO NA TRADUÇÃO: Invalid authentication token
⚠️  Usando texto original como fallback
```
→ Azure retornou erro, usando original como fallback

---

## 🧪 Testando Logs

### **Terminal 1 - Rodando Servidor:**
```bash
pm2 start src/index.js --name translation-server
pm2 logs translation-server
```

### **Terminal 2 - Cliente de Teste (Node.js):**
```bash
node test-client.js
```

Você verá os logs em **tempo real** no Terminal 1!

---

## 📱 Testando da Unity

### **Script C# para testes:**

```csharp
using UnityEngine;
using System.Net.WebSockets;
using System.Text;
using System.Threading.Tasks;

public class WebSocketDebugTest : MonoBehaviour
{
    private ClientWebSocket ws;

    async void Start()
    {
        ws = new ClientWebSocket();
        await ws.ConnectAsync(new System.Uri("ws://localhost:8080"), System.Threading.CancellationToken.None);
        
        Debug.Log("✅ [Unity] Conectado");

        // Enviar JOIN
        var joinMsg = new {
            type = "join",
            clientId = "alice",
            roomId = "game-room",
            language = "pt-BR"
        };
        
        var json = JsonUtility.ToJson(joinMsg);
        Debug.Log($"📤 [Unity] Enviando JOIN: {json}");
        
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(new System.ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, System.Threading.CancellationToken.None);

        // Enviar UTTERANCE
        var utteranceMsg = new {
            type = "utterance",
            utteranceId = "msg-001",
            speakerId = "alice",
            roomId = "game-room",
            language = "pt-BR",
            text = "Oi, tudo bem?"
        };
        
        json = JsonUtility.ToJson(utteranceMsg);
        Debug.Log($"📤 [Unity] Enviando UTTERANCE: {json}");
        
        bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(new System.ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, System.Threading.CancellationToken.None);

        // Receber resposta
        byte[] buffer = new byte[4096];
        var result = await ws.ReceiveAsync(new System.ArraySegment<byte>(buffer), System.Threading.CancellationToken.None);
        
        string response = Encoding.UTF8.GetString(buffer, 0, result.Count);
        Debug.Log($"📥 [Unity] Recebido: {response}");
    }
}
```

---

## 📊 Estrutura dos Logs

```
┌─ TIMESTAMP (HH:MM:SS)
│
├─ EMOJI (para visual rápido)
│  ✅ Sucesso
│  ❌ Erro
│  ⚠️  Aviso
│  📨 Mensagem recebida
│  📤 Mensagem enviada
│  🔄 Processamento
│  🌐 Rede/Azure
│  
├─ SEÇÃO ESPECÍFICA
│  [Conexão] [Mensagem] [Handler] [Azure]
│
└─ DETALHES COLORIDOS
   Informações estruturadas e legíveis
```

---

## 🎯 Checklist de Debugging

Quando algo não funciona, verifique os logs em ordem:

- [ ] ✅ Cliente conectou? → `✅ [HH:MM:SS] CONEXÃO #X ACEITA`
- [ ] ✅ JOIN foi recebido? → `📨 [HH:MM:SS] MENSAGEM RECEBIDA` + `"type": "join"`
- [ ] ✅ JOIN foi processado? → `✅ [HH:MM:SS] PROCESSADOR: JOIN`
- [ ] ✅ UTTERANCE foi recebido? → `📨 [HH:MM:SS] MENSAGEM RECEBIDA` + `"type": "utterance"`
- [ ] ✅ UTTERANCE foi processado? → `✅ [HH:MM:SS] PROCESSADOR: UTTERANCE`
- [ ] ✅ Clientes na sala? → `📊 Clientes na sala "room-x": 2`
- [ ] ✅ Azure respondeu? → `🌐 REQUISIÇÃO AZURE TRANSLATOR` + `✅ TRADUÇÃO RECEBIDA`
- [ ] ✅ Payload enviado? → `📤 Enviando payload` + `✅ Enviado com sucesso`

Se algum passo faltar, você encontrou o problema! 🎯

---

## 🚀 Comandos Úteis

### **Ver logs em tempo real:**
```bash
pm2 logs translation-server
```

### **Ver últimas 100 linhas:**
```bash
pm2 logs translation-server --lines 100
```

### **Filtrar apenas erros:**
```bash
pm2 logs translation-server 2>&1 | grep "❌"
```

### **Filtrar apenas conexões:**
```bash
pm2 logs translation-server 2>&1 | grep "CONEXÃO"
```

### **Salvar logs em arquivo:**
```bash
pm2 logs translation-server > server-logs.txt
```

---

**Versão:** 1.0  
**Última atualização:** Dezembro 2025  
**Status:** ✅ Pronto para Debug
