export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // GET
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "JARVIS Voice",
          status: "online",
          openai: !!env.OPENAI_API_KEY,
          elevenlabs: !!env.ELEVENLABS_API_KEY
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...corsHeaders
          }
        }
      );
    }

    // POST only
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "POST only"
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    try {
      const body = await request.json();

      const text =
        typeof body.text === "string"
          ? body.text.trim()
          : "";

      if (!text) {
        return new Response(
          JSON.stringify({
            error: "textがありません"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      // ==============================
      // OpenAI API
      // ==============================

      if (!env.OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({
            error: "OPENAI_API_KEYが設定されていません"
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      const openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            input: [
              {
                role: "system",
                content:
                  "あなたはJARVISです。日本語で自然に会話してください。回答は簡潔で分かりやすくしてください。"
              },
              {
                role: "user",
                content: text
              }
            ]
          })
        }
      );

      const openaiData = await openaiResponse.json();

      if (!openaiResponse.ok) {
        return new Response(
          JSON.stringify({
            error: "OpenAI APIエラー",
            detail: openaiData
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      // OpenAI回答を取得
      const reply =
        openaiData.output_text ||
        openaiData.output
          ?.filter(item => item.type === "message")
          ?.flatMap(item => item.content || [])
          ?.filter(content => content.type === "output_text")
          ?.map(content => content.text)
          ?.join("") ||
        "申し訳ありません。回答を取得できませんでした。";

      // ==============================
      // ElevenLabs
      // ==============================

      if (!env.ELEVENLABS_API_KEY) {
        return new Response(
          JSON.stringify({
            ok: true,
            reply: reply,
            audio: null,
            warning: "ELEVENLABS_API_KEYが設定されていません"
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              ...corsHeaders
            }
          }
        );
      }

      const voiceId = "JBFqnCBsd6RMkjVDRZzb";

      const elevenResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: reply.substring(0, 2000),
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.42,
              similarity_boost: 0.78,
              style: 0.25,
              use_speaker_boost: true
            }
          })
        }
      );

      // ElevenLabsエラーでもOpenAI回答は返す
      if (!elevenResponse.ok) {
        const errorText = await elevenResponse.text();

        return new Response(
          JSON.stringify({
            ok: true,
            reply: reply,
            audio: null,
            warning: "ElevenLabs音声生成に失敗しました",
            detail: errorText
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              ...corsHeaders
            }
          }
        );
      }

      // 音声データ
      const audio = await elevenResponse.arrayBuffer();

      const bytes = new Uint8Array(audio);
      let binary = "";

      const chunkSize = 0x8000;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(
          ...bytes.subarray(i, i + chunkSize)
        );
      }

      const audioBase64 = btoa(binary);

      // ==============================
      // 最終レスポンス
      // ==============================

      return new Response(
        JSON.stringify({
          ok: true,
          reply: reply,
          audio: audioBase64,
          audio_type: "audio/mpeg"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Cache-Control": "no-store",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Workerでエラーが発生しました",
          detail: String(error)
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...corsHeaders
          }
        }
      );
    }
  }
};