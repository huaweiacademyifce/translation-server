using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Cliente WebSocket para chat com tradução em tempo real
/// </summary>
public class TranslationChatClient
{
    private ClientWebSocket _ws;
    private CancellationTokenSource _cts;
    private string _serverUrl;
    private string _clientId = string.Empty;
    private string _roomId = string.Empty;
    private string _language = string.Empty;
    private bool _isConnected;

    public event Action<string, string, string>? OnMessageReceived; // speakerId, originalText, translatedText
    public event Action<string>? OnError;
    public event Action? OnConnected;
    public event Action? OnDisconnected;

    public TranslationChatClient(string serverUrl = "ws://localhost:8080")
    {
        _serverUrl = serverUrl;
        _ws = new ClientWebSocket();
        _cts = new CancellationTokenSource();
    }

    /// <summary>
    /// Conecta ao servidor e entra na sala
    /// </summary>
    public async Task ConnectAsync(string clientId, string roomId, string language)
    {
        try
        {
            _clientId = clientId;
            _roomId = roomId;
            _language = language;

            await _ws.ConnectAsync(new Uri(_serverUrl), _cts.Token);
            _isConnected = true;
            OnConnected?.Invoke();

            // Enviar mensagem de join
            var joinMessage = new
            {
                type = "join",
                clientId = _clientId,
                roomId = _roomId,
                language = _language
            };
            await SendAsync(JsonSerializer.Serialize(joinMessage));

            // Iniciar recepção de mensagens
            _ = Task.Run(ReceiveLoop);

            Console.WriteLine($"✅ Conectado como '{clientId}' na sala '{roomId}' (idioma: {language})");
        }
        catch (Exception ex)
        {
            OnError?.Invoke($"Erro ao conectar: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Envia uma mensagem para tradução
    /// </summary>
    public async Task SendMessageAsync(string text)
    {
        if (!_isConnected)
        {
            OnError?.Invoke("Não conectado ao servidor");
            return;
        }

        try
        {
            var utterance = new
            {
                type = "utterance",
                utteranceId = Guid.NewGuid().ToString(),
                speakerId = _clientId,
                roomId = _roomId,
                originalLanguage = _language, // Corrigido!
                targetLanguage = _language,   // Corrigido! (ou defina para o idioma desejado)
                text = text
            };

            await SendAsync(JsonSerializer.Serialize(utterance));
            Console.WriteLine($"📤 Você: {text}");
        }
        catch (Exception ex)
        {
            OnError?.Invoke($"Erro ao enviar mensagem: {ex.Message}");
        }
    }

    /// <summary>
    /// Loop de recepção de mensagens
    /// </summary>
    private async Task ReceiveLoop()
    {
        var buffer = new byte[4096];
        var messageBuilder = new StringBuilder();

        try
        {
            while (_isConnected && _ws.State == WebSocketState.Open)
            {
                var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), _cts.Token);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await DisconnectAsync();
                    return;
                }

                var chunk = Encoding.UTF8.GetString(buffer, 0, result.Count);
                messageBuilder.Append(chunk);

                if (result.EndOfMessage)
                {
                    var message = messageBuilder.ToString();
                    messageBuilder.Clear();
                    HandleMessage(message);
                }
            }
        }
        catch (Exception ex)
        {
            OnError?.Invoke($"Erro na recepção: {ex.Message}");
            await DisconnectAsync();
        }
    }

    /// <summary>
    /// Processa mensagens recebidas
    /// </summary>
    private void HandleMessage(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeElement))
                return;

            var type = typeElement.GetString() ?? string.Empty;

            switch (type)
            {
                case "transcription":
                    HandleTranscription(root);
                    break;
                case "error":
                    if (root.TryGetProperty("message", out var errorMsg))
                    {
                        OnError?.Invoke($"⚠️ Servidor: {errorMsg.GetString()}");
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            OnError?.Invoke($"Erro ao processar mensagem: {ex.Message}");
        }
    }

    /// <summary>
    /// Processa mensagens de tradução
    /// </summary>
    private void HandleTranscription(JsonElement root)
    {
        var speakerId = root.GetProperty("speakerId").GetString() ?? string.Empty;
        var text = root.GetProperty("text").GetString() ?? string.Empty;
        var originalLang = root.GetProperty("originalLanguage").GetString() ?? string.Empty;
        var targetLang = root.GetProperty("targetLanguage").GetString() ?? string.Empty;

        // Não exibir tradução da própria mensagem para o mesmo idioma
        if (speakerId == _clientId && targetLang == _language)
            return;

        // Exibir tradução de outros usuários ou tradução para outros idiomas
        Console.WriteLine($"📥 {speakerId} ({originalLang}→{targetLang}): {text}");
        OnMessageReceived?.Invoke(speakerId, "", text);
    }

    /// <summary>
    /// Envia dados pelo WebSocket
    /// </summary>
    private async Task SendAsync(string message)
    {
        var bytes = Encoding.UTF8.GetBytes(message);
        await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, _cts.Token);
    }

    /// <summary>
    /// Desconecta do servidor
    /// </summary>
    public async Task DisconnectAsync()
    {
        if (!_isConnected)
            return;

        _isConnected = false;

        try
        {
            if (_ws.State == WebSocketState.Open)
            {
                await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client disconnecting", CancellationToken.None);
            }
        }
        catch { }
        finally
        {
            _ws?.Dispose();
            _cts?.Cancel();
            OnDisconnected?.Invoke();
            Console.WriteLine("❌ Desconectado do servidor");
        }
    }

    public bool IsConnected => _isConnected && _ws.State == WebSocketState.Open;
}

/// <summary>
/// Exemplo de uso: Chat com tradução em tempo real
/// </summary>
public class Program
{
    static async Task Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.WriteLine("=== Chat com Tradução em Tempo Real ===\n");

        // Solicitar informações do usuário
        Console.Write("Seu nome: ");
        string nome = Console.ReadLine() ?? string.Empty;

        Console.Write("ID da sala: ");
        string sala = Console.ReadLine() ?? string.Empty;

        Console.Write("Seu idioma (pt-BR, en-US, es-ES, etc): ");
        string idioma = Console.ReadLine() ?? string.Empty;

        Console.Write("URL do servidor (deixe vazio para ws://localhost:8080): ");
        string serverUrl = Console.ReadLine() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(serverUrl))
            serverUrl = "ws://localhost:9000";

        Console.WriteLine();

        // Criar e conectar cliente
        var client = new TranslationChatClient(serverUrl);

        // Configurar eventos
        client.OnError += (msg) => Console.WriteLine($"❌ {msg}");
        client.OnConnected += () => Console.WriteLine("✅ Conectado! Digite suas mensagens ou 'sair' para encerrar.\n");
        client.OnDisconnected += () => Console.WriteLine("Conexão encerrada.");

        try
        {
            await client.ConnectAsync(nome ?? string.Empty, sala ?? string.Empty, idioma ?? string.Empty);

            // Loop de mensagens
            while (client.IsConnected)
            {
                var mensagem = Console.ReadLine();

                if (string.IsNullOrWhiteSpace(mensagem))
                    continue;

                if (mensagem.ToLower() == "sair")
                {
                    await client.DisconnectAsync();
                    break;
                }

                await client.SendMessageAsync(mensagem);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Erro: {ex.Message}");
        }

        Console.WriteLine("\nPressione qualquer tecla para sair...");
        Console.ReadKey();
    }
}
