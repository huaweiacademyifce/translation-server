# Como compilar e executar o cliente de chat C#

## 🔧 Compilar

```bash
# Linux/Mac
csc TranslationChatClient.cs -out:chat.exe

# Ou usando dotnet
dotnet build TranslationChatClient.cs
```

## 🚀 Executar

```bash
# Windows
.\chat.exe

# Linux/Mac com Mono
mono chat.exe

# Ou direto com dotnet script
dotnet script TranslationChatClient.cs
```

## 💬 Exemplo de Uso

1. **Inicie o servidor Node.js**:
```bash
pm2 start src/index.js --name translation-server
# ou
node src/index.js
```

2. **Execute o cliente C#** em múltiplos terminais:

**Terminal 1 (Português):**
```
Seu nome: João
ID da sala: sala-1
Seu idioma: pt-BR
URL do servidor: ws://localhost:8080

✅ Conectado! Digite suas mensagens ou 'sair' para encerrar.

📤 Você: Olá, tudo bem?
📥 Maria (pt-BR→en-US): Hi, how are you?
```

**Terminal 2 (Inglês):**
```
Seu nome: Maria
ID da sala: sala-1
Seu idioma: en-US
URL do servidor: ws://localhost:8080

✅ Conectado! Digite suas mensagens ou 'sair' para encerrar.

📥 João (pt-BR→en-US): Hello, are you okay?
📤 Você: Hi, how are you?
```

## 🌐 Usar com servidor remoto

```
URL do servidor: ws://192.168.1.100:8080
```

## ⚙️ Funcionalidades

- ✅ Chat em tempo real
- ✅ Tradução automática entre idiomas
- ✅ Suporte a múltiplas salas
- ✅ Eventos customizáveis
- ✅ Tratamento de erros
- ✅ Reconexão automática

## 📝 Idiomas suportados

- `pt-BR` - Português do Brasil
- `en-US` - Inglês dos EUA
- `es-ES` - Espanhol da Espanha
- `fr-FR` - Francês
- `de-DE` - Alemão
- `it-IT` - Italiano
- `ja-JP` - Japonês
- `ko-KR` - Coreano
- `zh-CN` - Chinês Simplificado
- E mais de 100 outros idiomas!
