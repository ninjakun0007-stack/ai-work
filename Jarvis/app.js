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
let currentSource = null;


// ========================================
// AudioContext
// ========================================

function getAudioContext() {

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

  return audioContext;
}


// ========================================
// 音声テスト
// ========================================

async function testWebAudio() {

  try {

    statusText.textContent =
      "🔊 音声テスト中...";

    message.textContent =
      "テスト音を再生しています";

    const ctx =
      getAudioContext();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const oscillator =
      ctx.createOscillator();

    const gain =
      ctx.createGain();

    oscillator.type =
      "sine";

    oscillator.frequency.value =
      880;

    gain.gain.value =
      0.3;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const start =
      ctx.currentTime;

    oscillator.start(start);
    oscillator.stop(start + 0.5);

    oscillator.onended =
      () => {

        statusText.textContent =
          "🔊 音声テスト成功";

        message.textContent =
          "音声再生は正常です";
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
    testWebAudio
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
    async () => {

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

        /*
         * iPhone Safari対策
         * ユーザー操作直後にAudioContextを起動
         */

        try {

          const ctx =
            getAudioContext();

          if (ctx.state === "suspended") {
            await ctx.resume();
          }

        } catch (_) {}

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

          throw new Error(
            (
              data.error ||
              `HTTP ${response.status}`
            ) +
            (
              detail
                ? "\n" + detail
                : ""
            )
          );
        }

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

          statusText.textContent =
            "🔊 JARVISが話しています";

          await playAudioWithWebAudio(
            data.audio
          );

        } else {

          statusText.textContent =
            "音声データなし";

          message.textContent =
            reply +
            "\n\n【ElevenLabs音声なし】";
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
// ElevenLabs MP3
// Web Audio APIで再生
// ========================================

async function playAudioWithWebAudio(
  base64Audio
) {

  try {

    console.log(
      "ElevenLabs audio length:",
      base64Audio.length
    );


    const ctx =
      getAudioContext();


    if (ctx.state === "suspended") {

      await ctx.resume();
    }


    // ------------------------------------
    // Base64 → Uint8Array
    // ------------------------------------

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


    console.log(
      "MP3 bytes:",
      bytes.length
    );


    if (bytes.length === 0) {

      throw new Error(
        "音声データが空です"
      );
    }


    // ------------------------------------
    // MP3をデコード
    // ------------------------------------

    statusText.textContent =
      "🔊 音声を準備しています...";


    const audioBuffer =
      await ctx.decodeAudioData(
        bytes.buffer.slice(0)
      );


    console.log(
      "Audio decoded:",
      audioBuffer.duration,
      "seconds"
    );


    // ------------------------------------
    // 前の音声を停止
    // ------------------------------------

    if (currentSource) {

      try {
        currentSource.stop();
      } catch (_) {}

      currentSource =
        null;
    }


    // ------------------------------------
    // 音声ソース作成
    // ------------------------------------

    const source =
      ctx.createBufferSource();


    source.buffer =
      audioBuffer;


    const gain =
      ctx.createGain();


    gain.gain.value =
      1.0;


    source.connect(
      gain
    );


    gain.connect(
      ctx.destination
    );


    currentSource =
      source;


    source.onended =
      () => {

        currentSource =
          null;

        statusText.textContent =
          "待機中";
      };


    // ------------------------------------
    // 再生
    // ------------------------------------

    statusText.textContent =
      "🔊 JARVISが話しています";


    source.start(0);


    console.log(
      "WEB AUDIO PLAY SUCCESS"
    );


  } catch (error) {

    console.error(
      "WEB AUDIO MP3 ERROR:",
      error
    );


    statusText.textContent =
      "音声再生エラー";


    message.textContent =
      message.textContent +
      "\n\n音声再生エラー：\n" +
      error.message;
  }
}