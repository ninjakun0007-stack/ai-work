const talkButton =
  document.getElementById("talkButton");

const audioTestButton =
  document.getElementById("audioTestButton");

const message =
  document.getElementById("message");

const statusText =
  document.getElementById("statusText");


const WORKER_URL =
  "https://jarvis-voice.ninjakun0007.workers.dev";


const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


let recognition = null;

let listening = false;

let audioPlayer = null;

let audioUrl = null;


// ========================================
// 音声テスト
// ========================================

if (audioTestButton) {

  audioTestButton.addEventListener(
    "click",
    async () => {

      try {

        statusText.textContent =
          "🔊 音声テスト中...";

        message.textContent =
          "音声を再生しています";


        const testAudio =
          new Audio();


        testAudio.volume =
          1.0;


        /*
          ユーザーがボタンをタップした
          直後にplay()を実行する
        */

        testAudio.src =
          "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";


        await testAudio.play();


        statusText.textContent =
          "🔊 音声テスト成功";

        message.textContent =
          "音声再生は許可されています";


        testAudio.onended =
          () => {

            statusText.textContent =
              "待機中";
          };


      } catch (error) {

        console.error(
          "AUDIO TEST ERROR:",
          error
        );


        statusText.textContent =
          "音声テスト失敗";


        message.textContent =
          "音声テスト失敗：\n" +
          error.message;
      }
    }
  );
}


// ========================================
// 音声認識
// ========================================

if (!SpeechRecognition) {

  message.textContent =
    "このSafariでは音声入力を利用できません";

  statusText.textContent =
    "音声認識非対応";

  talkButton.disabled =
    true;

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


        if (!response.ok) {

          let detail =
            "";


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
                ? "\n\n詳細：" +
                  detail
                : ""
            );


          statusText.textContent =
            "接続エラー";


          return;
        }


        const reply =
          data.reply ||
          "回答を取得できませんでした。";


        message.textContent =
          reply;


        // ==================================
        // ElevenLabs
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


  // ======================================
  // 音声認識エラー
  // ======================================

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


  // ======================================
  // 音声認識終了
  // ======================================

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


    if (audioUrl) {

      URL.revokeObjectURL(
        audioUrl
      );
    }


    audioUrl =
      URL.createObjectURL(
        blob
      );


    if (audioPlayer) {

      try {
        audioPlayer.pause();
      } catch (_) {}

    }


    audioPlayer =
      new Audio();


    audioPlayer.src =
      audioUrl;


    audioPlayer.preload =
      "auto";


    audioPlayer.volume =
      1.0;


    audioPlayer.onended =
      () => {

        statusText.textContent =
          "待機中";
      };


    audioPlayer.onerror =
      () => {

        statusText.textContent =
          "音声再生エラー";
      };


    statusText.textContent =
      "🔊 JARVISが話しています";


    await audioPlayer.play();


  } catch (error) {

    console.error(
      "ELEVENLABS AUDIO ERROR:",
      error
    );


    statusText.textContent =
      "音声再生エラー";


    message.textContent =
      "音声再生エラー：\n" +
      error.message;
  }
}