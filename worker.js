export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
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
          status: "online"
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...corsHeaders
          }
        }
      );
    }

    if (request.method !== "POST") {
      return new Response("POST only", {
        status: 405,
        headers: corsHeaders
      });
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

      const voiceId = "JBFqnCBsd6RMkjVDRZzb";

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text.substring(0, 2000),
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

      if (!response.ok) {
        const errorText = await response.text();

        return new Response(
          JSON.stringify({
            error: "ElevenLabs音声生成に失敗しました",
            detail: errorText
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

      const audio = await response.arrayBuffer();

      return new Response(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          ...corsHeaders
        }
      });

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Workerでエラーが発生しました"
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
  }
};