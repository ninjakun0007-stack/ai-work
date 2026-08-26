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
    // POST only
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

      // ======================================
      // リクエスト
      // ======================================

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
      // OpenAI
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

            body: JSON.stringify({

              model:
                "gpt-5-mini",

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


      const openaiData =
        await openaiResponse.json();


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
      // OpenAI回答
      // ======================================

      const reply =
        openaiData.output_text ||