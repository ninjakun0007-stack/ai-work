export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };


    // ========================================
    // OPTIONS
    // ========================================

    if (request.method === "OPTIONS") {

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }


    // ========================================
    // GET
    // ========================================

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
            "Content-Type":
              "application/json; charset=UTF-8",
            ...corsHeaders
          }
        }
      );
    }


    // ========================================
    // POST
    // ========================================

    if (request.method !== "POST") {

      return new Response(
        JSON.stringify({
          error: "POST only"
        }),
        {
          status: 405,
          headers: {
            "Content-Type":
              "application/json",
            ...corsHeaders
          }
        }
      );
    }


    try {

      const body =
        await request.json();


      const text =
        typeof body.text === "string"
          ? body.text.trim()
          : "";


      if (!text) {

        return new Response(
          JSON.stringify({
            error:
              "textがありません"
          }),
          {
            status: 400,
            headers: {
              "Content-Type":
                "application/json",
              ...corsHeaders
            }
          }
        );
      }


      // ======================================
      // OpenAI API KEY
      // ======================================

      if (!env.OPENAI_API_KEY) {

        return new Response(
          JSON.stringify({
            error:
              "OPENAI_API_KEYが設定されていません"
          }),
          {
            status: 500,
            headers: {
              "Content-Type":
                "application/json",
              ...corsHeaders
            }
          }
        );
      }


      // ======================================
      // Web検索を使うか判定
      // ======================================

      const searchWords = [

        "天気",
        "今日の天気",
        "今の天気",
        "現在の天気",
        "気温",
        "降水確率",

        "ニュース",
        "最新ニュース",
        "最新情報",

        "現在",
        "今現在",
        "リアルタイム",

        "株価",
        "為替",
        "ドル円",

        "価格",
        "値段",

        "営業時間",
        "現在営業",

        "検索して",
        "調べて",
        "調べてみて"

      ];


      const needsWebSearch =
        searchWords.some(
          word =>
            text.includes(word)
        );


      // ======================================
      // OpenAI Responses API
      // ======================================

      const requestBody = {

        model:
          "gpt-5-mini",

        input: [

          {
            role: "system",

            content:
              "あなたはJARVISです。" +
              "日本語で自然に会話してください。" +
              "回答は簡潔で分かりやすくしてください。" +
              "ユーザーが最新情報、現在の情報、天気、ニュース、価格などを尋ねた場合は、Web検索を使用して最新情報を確認してください。" +
              "Web検索結果が取得できない場合は、推測せず、そのことを明確に伝えてください。"
          },

          {
            role: "user",

            content: text
          }

        ]

      };


      // ======================================
      // Web検索
      // ======================================

      if (needsWebSearch) {

        requestBody.tools = [
          {
            type:
              "web_search_preview"
          }
        ];
      }


      console.log(
        "WEB SEARCH:",
        needsWebSearch
      );


      // ======================================
      // OpenAI
      // ======================================

      const openaiResponse =
        await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",

            headers: {
              "Authorization":
                `Bearer ${env.OPENAI_API_KEY}`,

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                requestBody
              )
          }
        );


      const openaiData =
        await openaiResponse.json();


      // ======================================
      // OpenAIエラー
      // ======================================

      if (!openaiResponse.ok) {

        return new Response(
          JSON.stringify({
            error:
              "OpenAI APIエラー",

            detail:
              openaiData
          }),
          {
            status: 500,

            headers: {
              "Content-Type":
                "application/json",
              ...corsHeaders
            }
          }
        );
      }


      // ======================================
      // 回答取得
      // ======================================

      let reply = "";


      if (
        typeof openaiData.output_text ===
        "string"
      ) {

        reply =
          openaiData.output_text.trim();
      }


      if (
        !reply &&
        Array.isArray(
          openaiData.output
        )
      ) {

        for (
          const item
          of openaiData.output
        ) {

          if (
            item &&
            item.type === "message" &&
            Array.isArray(
              item.content
            )
          ) {

            for (
              const content
              of item.content
            ) {

              if (
                content &&
                content.type ===
                  "output_text" &&
                typeof content.text ===
                  "string"
              ) {

                reply +=
                  content.text;
              }
            }
          }
        }
      }


      reply =
        reply.trim();


      if (!reply) {

        reply =
          "申し訳ありません。" +
          "回答を取得できませんでした。";
      }


      // ======================================
      // ElevenLabs
      // ======================================

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


      // ======================================
      // ElevenLabs Voice
      // ======================================

      const voiceId =
        "JBFqnCBsd6RMkjVDRZzb";


      const elevenResponse =
        await fetch(

          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,

          {
            method: "POST",

            headers: {

              "xi-api-key":
                env.ELEVENLABS_API_KEY,

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                text:
                  reply.substring(
                    0,
                    2000
                  ),

                model_id:
                  "eleven_multilingual_v2",

                voice_settings: {

                  stability:
                    0.42,

                  similarity_boost:
                    0.78,

                  style:
                    0.25,

                  use_speaker_boost:
                    true
                }

              })
          }
        );


      // ======================================
      // ElevenLabsエラー
      // ======================================

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

            detail:
              errorText

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


      // ======================================
      // 音声データ
      // ======================================

      const audio =
        await elevenResponse
          .arrayBuffer();


      if (
        !audio ||
        audio.byteLength === 0
      ) {

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


      // ======================================
      // ArrayBuffer → Base64
      // ======================================

      const bytes =
        new Uint8Array(
          audio
        );


      let binary = "";


      const chunkSize =
        0x8000;


      for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
      ) {

        binary +=
          String.fromCharCode(
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


      // ======================================
      // 完成レスポンス
      // ======================================

      return new Response(

        JSON.stringify({

          ok: true,

          reply: reply,

          audio:
            audioBase64,

          audio_type:
            "audio/mpeg",

          audio_size:
            audio.byteLength,

          web_search:
            needsWebSearch

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

      console.error(
        "WORKER ERROR:",
        error
      );


      return new Response(

        JSON.stringify({

          ok: false,

          error:
            "Workerでエラーが発生しました",

          detail:
            String(error)

        }),

        {
          status: 500,

          headers: {

            "Content-Type":
              "application/json",

            ...corsHeaders
          }
        }
      );
    }
  }
};