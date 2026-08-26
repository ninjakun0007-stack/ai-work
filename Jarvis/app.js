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
let stopRecognition = null;

let audioContext = null;
let currentSource = null;

let listening = false;
let speaking = false;
let conversationStarted = false;

let starting = false;
let stopListeningActive = false;


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
// AudioContext起動
// ========================================

async function unlockAudio() {

  try {

    const ctx =
      getAudioContext();

    if (
      ctx.state ===
      "suspended"
    ) {

      await ctx.resume();
    }

  } catch (error) {

    console.log(
      "Audio unlock:",
      error.message
    );
  }
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

    await unlockAudio();

    const ctx =
      getAudioContext();

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

    oscillator.connect(
      gain
    );

    gain.connect(
      ctx.destination
    );

    oscillator.start();

    oscillator.stop(
      ctx.currentTime +
      0.5
    );

    oscillator.onended =
      () => {

        statusText.textContent =
          "🔊 音声テスト成功";

        message.textContent =
          "音声再生は正常です";
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


if (audioTestButton) {

  audioTestButton.addEventListener(
    "click",
    testWebAudio
  );
}


// ========================================
// ストップ命令
// ========================================

function isStopCommand(text) {

  const value =
    text
      .trim()
      .replace(
        /[！!。．、,？?]/g,
        ""
      );

  const commands = [

    "ストップ",
    "止まって",
    "止まれ",
    "止めて",
    "止めろ",
    "静かに",
    "黙って",
    "もういい",
    "やめて",
    "やめろ",
    "停止",
    "音声停止"

  ];

  return commands.some(
    command =>
      value.includes(command)
  );
}


// ========================================
// JARVIS音声停止
// ========================================

function stopSpeaking() {

  console.log(
    "STOP COMMAND RECEIVED"
  );


  if (currentSource) {

    try {

      currentSource.stop();

    } catch (_) {}

    currentSource =
      null;
  }


  speaking =
    false;


  statusText.textContent =
    "🔇 停止しました";

  message.textContent =
    "JARVISの音声を停止しました";


  // ストップ監視を停止

  stopStopRecognition();


  // その後もう一度聞く

  if (conversationStarted) {

    setTimeout(
      () => {

        startListening();

      },
      700
    );
  }
}


// ========================================
// 「ストップ」専用音声認識開始
// ========================================

function startStopRecognition() {

  if (!SpeechRecognition) {
    return;
  }

  if (stopListeningActive) {
    return;
  }

  try {

    stopRecognition =
      new SpeechRecognition();

    stopRecognition.lang =
      "ja-JP";

    stopRecognition.continuous =
      true;

    stopRecognition.interimResults =
      true;

    stopRecognition.maxAlternatives =
      1;


    stopRecognition.onresult =
      (event) => {

        for (
          let i =
            event.resultIndex;
          i <
            event.results.length;
          i++
        ) {

          const text =
            event.results[i][0]
              .transcript
              .trim();


          console.log(
            "STOP LISTENER:",
            text
          );


          if (
            isStopCommand(text)
          ) {

            stopSpeaking();

            return;
          }
        }
      };


    stopRecognition.onerror =
      (event) => {

        console.log(
          "STOP LISTENER ERROR:",
          event.error
        );

        stopListeningActive =
          false;
      };


    stopRecognition.onend =
      () => {

        stopListeningActive =
          false;


        // JARVISがまだ話しているなら
        // ストップ監視を再開

        if (speaking) {

          setTimeout(
            () => {

              startStopRecognition();

            },
            300
          );
        }
      };


    stopRecognition.start();

    stopListeningActive =
      true;


    console.log(
      "STOP LISTENER START"
    );

  } catch (error) {

    console.log(
      "STOP LISTENER START ERROR:",
      error.message
    );

    stopListeningActive =
      false;
  }
}


// ========================================
// 「ストップ」専用認識停止
// ========================================

function stopStopRecognition() {

  if (!stopRecognition) {
    return;
  }


  try {

    stopRecognition.stop();

  } catch (_) {}


  stopRecognition =
    null;

  stopListeningActive =
    false;
}


// ========================================
// 通常音声認識
// ========================================

function createRecognition() {

  if (!SpeechRecognition) {
    return null;
  }


  const r =
    new SpeechRecognition();


  r.lang =
    "ja-JP";

  r.continuous =
    false;

  r.interimResults =
    false;

  r.maxAlternatives =
    1;


  // ======================================
  // 認識結果
  // ======================================

  r.onresult =
    async (event) => {

      listening =
        false;


      const text =
        event.results[0][0]
          .transcript
          .trim();


      console.log(
        "USER:",
        text
      );


      // 念のためストップ命令を確認

      if (
        isStopCommand(text)
      ) {

        stopSpeaking();

        return;
      }


      message.textContent =
        `「${text}」`;


      if (!text) {

        restartListening();

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
          typeof data.audio ===
            "string"
        ) {

          await playAudioWithWebAudio(
            data.audio
          );

        } else {

          statusText.textContent =
            "音声データなし";


          message.textContent =
            reply +
            "\n\n【ElevenLabs音声なし】";


          restartListening();
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


        restartListening();
      }
    };


  // ======================================
  // 認識エラー
  // ======================================

  r.onerror =
    (event) => {

      listening =
        false;


      console.log(
        "SpeechRecognition ERROR:",
        event.error
      );


      if (
        event.error ===
        "not-allowed"
      ) {

        statusText.textContent =
          "マイク許可が必要です";


        message.textContent =
          "Safariのマイク許可を確認してください";


        if (talkButton) {

          talkButton.textContent =
            "🎙️ 話す";
        }

        return;
      }


      if (
        event.error ===
        "aborted"
      ) {

        return;
      }


      if (!speaking) {

        statusText.textContent =
          "音声入力エラー";
      }


      restartListening();
    };


  // ======================================
  // 認識終了
  // ======================================

  r.onend =
    () => {

      listening =
        false;


      if (talkButton) {

        if (!speaking) {

          talkButton.textContent =
            "🎙️ 話す";
        }
      }


      console.log(
        "SpeechRecognition END"
      );
    };


  return r;
}


// ========================================
// マイク開始
// ========================================

async function startListening() {

  if (!SpeechRecognition) {

    message.textContent =
      "このSafariでは音声入力を利用できません";

    statusText.textContent =
      "音声認識非対応";

    return;
  }


  if (
    listening ||
    starting ||
    speaking
  ) {

    return;
  }


  try {

    starting =
      true;


    await unlockAudio();


    recognition =
      createRecognition();


    if (!recognition) {

      throw new Error(
        "音声認識を作成できません"
      );
    }


    listening =
      true;


    message.textContent =
      "お話しください";


    statusText.textContent =
      "🎙️ 聞いています...";


    if (talkButton) {

      talkButton.textContent =
        "🔴 聞いています";
    }


    recognition.start();


    console.log(
      "MIC START"
    );


  } catch (error) {

    console.error(
      "MIC START ERROR:",
      error
    );


    listening =
      false;


    if (talkButton) {

      talkButton.textContent =
        "🎙️ 話す";
    }


    statusText.textContent =
      "待機中";

  } finally {

    starting =
      false;
  }
}


// ========================================
// 自動再開
// ========================================

function restartListening() {

  if (!conversationStarted) {
    return;
  }


  if (speaking) {
    return;
  }


  setTimeout(
    () => {

      if (!speaking) {

        startListening();
      }

    },
    1000
  );
}


// ========================================
// 話すボタン
// ========================================

if (talkButton) {

  talkButton.addEventListener(
    "click",
    async () => {

      conversationStarted =
        true;


      await startListening();
    }
  );
}


// ========================================
// ElevenLabs音声再生
// ========================================

async function playAudioWithWebAudio(
  base64Audio
) {

  try {

    const ctx =
      getAudioContext();


    if (
      ctx.state ===
      "suspended"
    ) {

      await ctx.resume();
    }


    // ------------------------------------
    // Base64 → バイナリ
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


    if (bytes.length === 0) {

      throw new Error(
        "音声データが空です"
      );
    }


    // ------------------------------------
    // MP3デコード
    // ------------------------------------

    statusText.textContent =
      "🔊 音声を準備しています...";


    const audioBuffer =
      await ctx.decodeAudioData(
        bytes.buffer.slice(0)
      );


    // ------------------------------------
    // 前の音声停止
    // ------------------------------------

    if (currentSource) {

      try {

        currentSource.stop();

      } catch (_) {}

      currentSource =
        null;
    }


    // ------------------------------------
    // 音声ソース
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


    speaking =
      true;


    // ====================================
    // ストップ監視開始
    // ====================================

    startStopRecognition();


    // ====================================
    // 音声終了
    // ====================================

    source.onended =
      () => {

        currentSource =
          null;


        speaking =
          false;


        stopStopRecognition();


        statusText.textContent =
          "待機中";


        console.log(
          "JARVIS音声終了"
        );


        restartListening();
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


    speaking =
      false;


    stopStopRecognition();


    statusText.textContent =
      "音声再生エラー";


    message.textContent =
      message.textContent +
      "\n\n音声再生エラー：\n" +
      error.message;


    restartListening();
  }
}


// ========================================
// 初期画面
// ========================================

window.addEventListener(
  "load",
  () => {

    message.textContent =
      "JARVIS起動完了";


    statusText.textContent =
      "🎙️ 話すボタンをタップしてください";


    if (talkButton) {

      talkButton.textContent =
        "🎙️ 話す";
    }
  }
);