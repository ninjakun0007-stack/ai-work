const talkButton = document.getElementById("talkButton");
const audioTestButton = document.getElementById("audioTestButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const WORKER_URL =
  "https://jarvis-voice.ninjakun0007.workers.dev";

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;
let listening = false;
let audioContext = null;


// ========================================
// Web Audio 音声テスト
// ========================================

async function testWebAudio() {

  try {

    statusText.textContent =
      "🔊 音声テスト中...";

    message.textContent =
      "テスト音を再生しています";


    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;


    if (!AudioContext) {

      throw new Error(
        "Web Audio APIに対応していません"
      );
    }


    if (!audioContext) {

      audioContext =
        new AudioContext();
    }


    // iPhone Safariでは
    // suspendedからresumeする必要がある場合がある

    if (
      audioContext.state ===
      "suspended"
    ) {

      await audioContext.resume();
    }


    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();


    oscillator.type =
      "sine";


    oscillator.frequency.value =
      880;


    gain.gain.value =
      0.3;


    oscillator.connect(
      gain
    );


    gain.connect(
      audioContext.destination
    );


    const startTime =
      audioContext.currentTime;


    oscillator.start(
      startTime
    );


    oscillator.stop(
      startTime + 0.5
    );


    oscillator.onended =
      () => {

        statusText.textContent =
          "🔊 音声テスト成功";

        message.textContent =
          "iPhoneの音声再生が動作しました";
      };


  } catch (error) {

    console.error(
      "WEB AUDIO TEST ERROR:",
      error
    );


    statusText.textContent =
      "音声テスト失敗";


    message.textContent =
      "音声テスト失敗：\n" +
      error.message;
  }
}


// ========================================
// 音声テストボタン
// ========================================

if (audioTestButton) {

  audioTestButton.addEventListener(
    "click",
    () => {

      testWebAudio();

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
  // 話す
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
  // 認識結果
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

          const detail =
            data.detail
              ? JSON.stringify(
                  data.detail,
                  null,
                  2
                )
              : "";


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


        if (
          data.audio &&
          typeof data.audio ===
            "string"
        ) {

          statusText.textContent =
            "🔊 JARVISが話しています";


          playElevenLabsAudio(
            data.audio
          );

        } else {

          statusText.textContent =
            "音声データなし";
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
  // 認識エラー
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
  // 認識終了
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


    const url =
      URL.createObjectURL(
        blob
      );


    const audio =
      new Audio(url);


    audio.volume =
      1.0;


    audio.onended =
      () => {

        URL.revokeObjectURL(
          url
        );

        statusText.textContent =
          "待機中";
      };


    audio.onerror =
      () => {

        URL.revokeObjectURL(
          url
        );

        statusText.textContent =
          "音声再生エラー";
      };


    await audio.play();


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