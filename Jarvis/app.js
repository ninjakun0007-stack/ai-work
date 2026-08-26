const talkButton = document.getElementById("talkButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const WORKER_URL =
  "https://jarvis-voice.ninjakun0007.workers.dev";

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let audioPlayer = null;
let audioContext = null;
let audioUnlocked = false;


// ========================================
// iPhone Safari 音声再生準備
// ========================================

async function unlockAudio() {

  try {

    if (!audioContext) {

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (AudioContextClass) {
        audioContext =
          new AudioContextClass();
      }
    }

    if (
      audioContext &&
      audioContext.state === "suspended"
    ) {

      await audioContext.resume();
    }

    audioUnlocked = true;

    console.log(
      "Audio unlocked:",
      audioContext
        ? audioContext.state
        : "no AudioContext"
    );

  } catch (error) {

    console.error(
      "Audio unlock error:",
      error
    );
  }
}


// ========================================
// 音声認識非対応
// ========================================

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


  // ======================================
  // 話すボタン
  // ======================================

  talkButton.addEventListener(
    "click",
    async () => {

      if (listening) return;


      // iPhone Safariで音声再生を解除
      await unlockAudio();


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


          message.textContent =
            "エラー：" +
            (data.error ||
              `HTTP ${response.status}`) +
            (detail
              ? "\n\n詳細：" +
                detail
              : "");


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

    // 前の音声を停止
    if (audioPlayer) {

      try {
        audioPlayer.pause();
      } catch (_) {}

      audioPlayer =
        null;
    }


    // Base64 → バイナリ
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


    // MP3
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


    // Audio生成
    const audio =
      new Audio();


    audioPlayer =
      audio;


    audio.src =
      audioUrl;

    audio.preload =
      "auto";

    audio.volume =
      1.0;


    audio.onended =
      () => {

        URL.revokeObjectURL(
          audioUrl
        );

        audioPlayer =
          null;

        statusText.textContent =
          "待機中";
      };


    audio.onerror =
      () => {

        URL.revokeObjectURL(
          audioUrl
        );

        audioPlayer =
          null;

        statusText.textContent =
          "音声再生エラー";
      };


    // ====================================
    // AudioContextを再開
    // ====================================

    if (
      audioContext &&
      audioContext.state ===
        "suspended"
    ) {

      await audioContext.resume();
    }


    // ====================================
    // 再生
    // ====================================

    await audio.play();


    statusText.textContent =
      "🔊 JARVISが話しています";


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