const talkButton = document.getElementById("talkButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const WORKER_URL =
  "https://jarvis-voice.ninjakun0007.workers.dev";

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


if (!SpeechRecognition) {

  message.textContent =
    "このSafariでは音声入力を利用できません";

  statusText.textContent =
    "音声認識非対応";

  talkButton.disabled = true;

} else {

  const recognition =
    new SpeechRecognition();

  recognition.lang =
    "ja-JP";

  recognition.continuous =
    false;

  recognition.interimResults =
    false;

  recognition.maxAlternatives =
    1;


  let listening =
    false;


  // ========================================
  // 話すボタン
  // ========================================

  talkButton.addEventListener(
    "click",
    () => {

      if (listening) return;

      try {

        listening =
          true;

        message.textContent =
          "お話しください";

        statusText.textContent =
          "聞いています...";

        talkButton.textContent =
          "🔴 聞いています";

        recognition.start();

      } catch (error) {

        listening =
          false;

        message.textContent =
          "音声入力を開始できませんでした";

        statusText.textContent =
          error.message ||
          "開始エラー";

        talkButton.textContent =
          "🎙️ 話す";
      }
    }
  );


  // ========================================
  // 音声認識結果
  // ========================================

  recognition.onresult =
    async (event) => {

      const text =
        event.results[0][0]
          .transcript
          .trim();


      message.textContent =
        `「${text}」`;


      if (!text) return;


      statusText.textContent =
        "JARVISが考えています...";


      try {

        const response =
          await fetch(
            WORKER_URL,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  text: text
                })
            }
          );


        // JSONとして受信
        const data =
          await response.json();


        console.log(
          "JARVIS RESPONSE:",
          data
        );


        // ==================================
        // Workerエラー
        // ==================================

        if (!response.ok) {

          let detail = "";


          if (data.detail) {

            if (
              typeof data.detail ===
              "string"
            ) {

              detail =
                data.detail;

            } else {

              detail =
                JSON.stringify(
                  data.detail,
                  null,
                  2
                );
            }
          }


          const errorMessage =
            data.error ||
            `HTTP ${response.status}`;


          message.textContent =
            "エラー：" +
            errorMessage +
            (detail
              ? "\n\n詳細：" +
                detail
              : "");


          statusText.textContent =
            "接続エラー";


          return;
        }


        // ==================================
        // OpenAI回答
        // ==================================

        const reply =
          data.reply ||
          "回答を取得できませんでした。";


        message.textContent =
          reply;


        // ==================================
        // ElevenLabs音声
        // ==================================

        if (
          data.audio &&
          typeof data.audio ===
            "string"
        ) {

          statusText.textContent =
            "🔊 JARVISが話しています";


          await playElevenLabsAudio(
            data.audio
          );


        } else {

          statusText.textContent =
            "音声データなし";


          message.textContent =
            reply +
            "\n\n【音声データがありません】";
        }


      } catch (error) {

        console.error(
          "JARVIS ERROR:",
          error
        );


        message.textContent =
          "接続エラー：\n" +
          error.message;


        statusText.textContent =
          "接続エラー";
      }
    };


  // ========================================
  // 音声認識エラー
  // ========================================

  recognition.onerror =
    (event) => {

      listening =
        false;

      message.textContent =
        "もう一度お話しください";

      statusText.textContent =
        event.error ||
        "音声入力エラー";

      talkButton.textContent =
        "🎙️ 話す";
    };


  // ========================================
  // 音声認識終了
  // ========================================

  recognition.onend =
    () => {

      listening =
        false;

      talkButton.textContent =
        "🎙️ 話す";
    };
}


// ========================================
// ElevenLabs音声再生
// ========================================

async function playElevenLabsAudio(
  base64Audio
) {

  try {

    const binaryString =
      atob(base64Audio);


    const len =
      binaryString.length;


    const bytes =
      new Uint8Array(len);


    for (
      let i = 0;
      i < len;
      i++
    ) {

      bytes[i] =
        binaryString.charCodeAt(i);
    }


    const blob =
      new Blob(
        [bytes],
        {
          type:
            "audio/mpeg"
        }
      );


    const audioUrl =
      URL.createObjectURL(blob);


    const audio =
      new Audio(audioUrl);


    audio.volume =
      1.0;


    audio.onended =
      () => {

        URL.revokeObjectURL(
          audioUrl
        );

        statusText.textContent =
          "待機中";
      };


    audio.onerror =
      () => {

        URL.revokeObjectURL(
          audioUrl
        );

        statusText.textContent =
          "音声再生エラー";
      };


    await audio.play();


  } catch (error) {

    console.error(
      "Audio play error:",
      error
    );


    statusText.textContent =
      "音声再生エラー";

    message.textContent =
      "音声再生エラー：\n" +
      error.message;
  }
}