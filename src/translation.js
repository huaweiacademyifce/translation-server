// src/translation.js
import axios from "axios";

const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;
const key = process.env.AZURE_TRANSLATOR_KEY;
const region = process.env.AZURE_TRANSLATOR_REGION;

if (!endpoint || !key || !region) {
  console.warn(
    "[WARN] Azure Translator env vars missing. Check AZURE_TRANSLATOR_ENDPOINT, AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION"
  );
}

/**
 * Traduz um texto usando o Azure Translator.
 * @param {Object} params
 * @param {string} params.text - Texto original
 * @param {string} params.from - Idioma de origem (ex: "pt-BR")
 * @param {string} params.to   - Idioma de destino (ex: "en-US")
 */
export async function translateText({ text, from, to }) {
  if (!text) return "";

  // Se origem = destino, não precisa traduzir
  if (!to || from === to) {
    return text;
  }

  if (!endpoint || !key || !region) {
    console.error("[ERROR] Azure Translator not configured correctly.");
    // fallback pra não quebrar:
    return text;
  }

  try {
    const url = `${endpoint}/translate`;

    console.log(`\n    🌐 REQUISIÇÃO AZURE TRANSLATOR`);
    console.log(`    URL: ${url}`);
    console.log(`    De: ${from} → Para: ${to}`);
    console.log(
      `    Texto: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`
    );

    const response = await axios({
      method: "post",
      url,
      params: {
        "api-version": "3.0",
        from, // se quiser deixar autodetect, pode remover esse campo
        to, // pode ser "en-US", "pt-BR", etc.
      },
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-type": "application/json",
      },
      data: [
        {
          Text: text,
        },
      ],
    });

    const translations = response.data?.[0]?.translations;
    if (!translations || translations.length === 0) {
      console.warn(
        `    ⚠️  Nenhuma tradução retornada pela Azure`,
        response.data
      );
      return text;
    }

    const translatedText = translations[0].text;
    console.log(`    ✅ TRADUÇÃO RECEBIDA: "${translatedText}"`);
    return translatedText;
  } catch (err) {
    console.error(
      `    ❌ ERRO NA TRADUÇÃO:`,
      err.response?.data || err.message
    );
    console.log(`    ⚠️  Usando texto original como fallback`);
    // fallback pra não travar a app
    return text;
  }
}
