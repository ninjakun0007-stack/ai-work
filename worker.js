export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

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

      let reply = "";

      if (typeof openaiData.output_text === "string") {
        reply = openaiData.output_text.trim();
      }

      if (!reply && Array.isArray(openaiData.output)) {
        for (const item of openaiData.output) {
          if (
            item &&
            item.type === "message" &&
            Array.isArray(item.content)
          ) {
            for (const content of item.content) {
              if (
                content &&
                content.type === "output_text" &&
                typeof content.text === "string"
              ) {
                reply += content.text;
              }
            }
          }
        }
      }

      reply = reply.trim();

      if (!reply) {
        reply =
          "申し訳ありません。回答を取得できませんでした。";
      }

      if (!env.ELEVENLABS_API_KEY) {
        return new Response(
          JSON.stringify({
            ok: false,
            reply: reply,
            audio: null,
            error:
              "ELEVENLABS_API_KEYが設定されていません"
          }),
          {
            status: 500,
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              ...corsHeaders
            }
          }
        );
      }

      const voiceId =
        "JBFqnCBsd6RMkjVDRZzb";

      const elevenResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key":
              env.ELEVENLABS_API_KEY,
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            text: reply.substring(0, 2000),
            model_id:
              "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.42,
              similarity_boost: 0.78,
              style: 0.25,
              use_speaker_boost: true
            }
          })
        }
      );

      if (!elevenResponse.ok) {
        const errorText =
          await elevenResponse.text();

        return new Response(
          JSON.stringify({
            ok: false,
            reply: reply,
            audio: null,
            error:
              "ElevenLabs音声生成に失敗しました",
            detail: errorText
          }),
          {
            status: 500,
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              ...corsHeaders
            }
          }
        );
      }

      const audio =
        await elevenResponse.arrayBuffer();

      if (!audio || audio.byteLength === 0) {
        return new Response(
          JSON.stringify({
            ok: false,
            reply: reply,
            audio: null,
            error:
              "ElevenLabsから音声データが返されませんでした"
          }),
          {
            status: 500,
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              ...corsHeaders
            }
          }
        );
      }

      const bytes =
        new Uint8Array(audio);

      let binary = "";

      const chunkSize = 0x8000;

      for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
      ) {
        binary += String.fromCharCode(
          ...bytes.subarray(
            i,
            Math.min(
              i + chunkSize,
              bytes.length
            )
          )
        );
      }

      const audioBase64 =
        btoa(binary);

      return new Response(
        JSON.stringify({
          ok: true,
          reply: reply,
          audio: audioBase64,
          audio_type: "audio/mpeg",
          audio_size: audio.byteLength
        }),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/json; charset=UTF-8",
            "Cache-Control":
              "no-store",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Workerでエラーが発生しました",
          detail: String(error)
        }),
        {
          status: 500,
          headers: {
            "Content-Type":
              "application/json; charset=UTF-8",
            ...corsHeaders
          }
        }
      );
    }
  }
};