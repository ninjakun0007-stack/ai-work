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
          openai: false,
          elevenlabs: false,
          mode: "FREE"
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
            error: "textがありません"
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


      // ========================================
      // 無料版JARVIS回答
      // ========================================

      const value =
        text;


      let reply =
        "";


      if (
        value.includes("こんにちは") ||
        value.includes("こんばんは") ||
        value.includes("おはよう")
      ) {

        reply =
          "はい。JARVISです。ご用件をどうぞ。";

      }

      else if (
        value.includes("名前") ||
        value.includes("あなたは誰")
      ) {

        reply =
          "私はJARVISです。あなたの仕事をお手伝いします。";

      }

      else if (
        value.includes("元気") ||
        value.includes("調子")
      ) {

        reply =
          "はい。正常に稼働しています。";

      }

      else if (
        value.includes("何時") ||
        value.includes("時間")
      ) {

        const now =
          new Date();

        reply =
          "現在の時刻は" +
          now.toLocaleTimeString(
            "ja-JP",
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          ) +
          "です。";

      }

      else if (
        value.includes("求人") ||
        value.includes("仕事")
      ) {

        reply =
          "求人検索ですね。無料版JARVISで対応できます。";

      }

      else if (
        value.includes("検索") ||
        value.includes("調べて")
      ) {

        reply =
          "検索ですね。無料版JARVISで対応できます。";

      }

      else if (
        value.includes("テスト")
      ) {

        reply =
          "はい。JARVISは正常に動作しています。";

      }

      else if (
        value.includes("終了")
      ) {

        reply =
          "了解しました。待機状態に戻ります。";

      }

      else {

        reply =
          "「" +
          value +
          "」と認識しました。";

      }


      // ========================================
      // 完成レスポンス
      // ========================================

      return new Response(

        JSON.stringify({

          ok: true,

          reply: reply,

          audio: null,

          audio_type: null,

          web_search: false,

          mode: "FREE"

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