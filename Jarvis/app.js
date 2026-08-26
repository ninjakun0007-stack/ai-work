const talkButton = document.getElementById("talkButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const WORKER_URL =
  "https://jarvis-voice.ninjakun0007.workers.dev";

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;
let listening = false;
let audio = null;
let audioUrl = null;


// ========================================
// 音声プレイヤーを先に作る
// ========================================

function prepareAudio() {

  if (!audio) {

    audio = new Audio();

    audio.preload = "auto";

    audio.volume = 1.0;

    audio.onplay = () => {

      statusText.textContent =
        "🔊 JARVISが話しています";
    };

    audio.onended = () => {

      statusText.textContent =
        "待機中";
    };

    audio.onerror = () => {

      statusText.textContent =
        "音声再生エラー";

      message.textContent =
        "音声再生エラー";
    };
  }

  return audio;
}


// ========================================
// 音声認識対応確認
// ========================================

if (!SpeechRecognition) {

  message.textContent =
    "このSafariでは音声入力を利用できません";

  statusText.textContent =
    "音声認識非対応";

  talkButton.disabled = true;

} else {

  recognition =
    new SpeechRecognition();

  recognition.lang =
    "ja-JP";

  recognition.continuous =
    false;

  recognition.interimResults =
    false;

  recognition.maxAlternatives =
    1;


  // ======================================
  // 話すボタン
  // ======================================

  talkButton.addEventListener(
    "click",
    () => {

      if (listening) {
        return;
      }


      // ----------------------------------
      // 重要
      // ユーザーがタップした瞬間に
      // Audioオブジェクトを作成する
      // ----------------------------------

      prepareAudio();


      try {

        listening = true;

        message.textContent =
          "お話しください";

        statusText.textContent =
          "聞いています...";

        talkButton.textContent =
          "🔴 聞いています";

        recognition.start();

      } catch (error) {

        listening = false;

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


  // ======================================
  // 音声認識結果
  // ======================================

  recognition.onresult =
    async (event) => {

      const text =
        event.results[0][0]
          .transcript
          .trim();


      message.textContent =
        `「${text}」`;


      if (!text) {
        return;
      }


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

            detail =
              typeof data.detail ===
                "string"

                ? data.detail

                : JSON.stringify(
                    data.detail,
                    null,
                    2
                  );
          }


          message.textContent =
            "エラー：" +
            (
              data.error ||
              `HTTP ${response.status}`
            ) +
            (
              detail
                ? "\n\n詳細：" + detail
                : ""
            );


          statusText.textContent =
            "接続エラー";


          return;
        }


        // ==================================
        // JARVIS回答
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
          typeof data.audio === "string"
        ) {

          await playAudio(
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


  // ======================================
  // 音声認識エラー
  // ======================================

  recognition.onerror =
    (event) => {

      listening = false;

      message.textContent =
        "もう一度お話しください";

      statusText.textContent =
        event.error ||
        "音声入力エラー";

      talkButton.textContent =
        "🎙️ 話す";
    };


  // ======================================
  // 音声認識終了
  // ======================================

  recognition.onend =
    () => {

      listening = false;

      talkButton.textContent =
        "🎙️ 話す";
    };
}


// ========================================
// ElevenLabs音声再生
// ========================================

async function playAudio(
  base64Audio
) {

  try {

    const binary =
      atob(base64Audio);


    const bytes =
      new Uint8Array(
        binary.length
      );


    for (
      let i = 0;
      i < binary.length;
      i++
    ) {

      bytes[i] =
        binary.charCodeAt(i);
    }


    const blob =
      new Blob(
        [bytes],
        {
          type:
            "audio/mpeg"
        }
      );


    // ------------------------------------
    // 古いURLを削除
    // ------------------------------------

    if (audioUrl) {

      URL.revokeObjectURL(
        audioUrl
      );
    }


    audioUrl =
      URL.createObjectURL(blob);


    // ------------------------------------
    // ユーザー操作時に作った
    // 同じAudioオブジェクトを使用
    // ------------------------------------

    const player =
      prepareAudio();


    player.src =
      audioUrl;


    player.load();


    statusText.textContent =
      "🔊 JARVISが話しています";


    await player.play();


  } catch (error) {

    console.error(
      "AUDIO ERROR:",
      error
    );


    statusText.textContent =
      "音声再生エラー";


    message.textContent =
      "音声再生エラー：\n" +
      error.message;
  }
}