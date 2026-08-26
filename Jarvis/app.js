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

let audioContext = null;
let currentSource = null;

let listening = false;
let speaking = false;
let thinking = false;
let conversationStarted = false;

let restarting = false;
let shouldListen = false;


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

    if (ctx.state === "suspended") {
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

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();

    oscillator.stop(
      ctx.currentTime + 0.5
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
    "JARVIS STOP"
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


  // マイクはそのまま継続

  if (
    conversationStarted &&
    !listening
  ) {

    startRecognition();
  }
}


// ========================================
// 音声認識作成
// ========================================

function createRecognition() {

  if (!SpeechRecognition) {
    return null;
  }


  const r =
    new SpeechRecognition();


  r.lang =
    "ja-JP";

  // 連続認識

  r.continuous =
    true;

  // ストップ判定を早くする

  r.interimResults =
    true;

  r.maxAlternatives =
    1;


  // ======================================
  // 認識結果
  // ======================================

  r.onresult =
    async (event) => {

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {

        const result =
          event.results[i];

        const text =
          result[0]
            .transcript
            .trim();


        if (!text) {
          continue;
        }


        console.log(
          "VOICE:",
          text,
          "FINAL:",
          result.isFinal,
          "SPEAKING:",
          speaking
        );


        // ==================================
        // JARVISが話している間
        // 「ストップ」だけを見る
        // ==================================

        if (speaking) {

          if (
            isStopCommand(text)
          ) {

            stopSpeaking();
          }


          // JARVIS自身の声などは無視

          continue;
        }


        // ==================================
        // 通常会話
        // ==================================

        if (!result.isFinal) {
          continue;
        }


        // ストップ命令

        if (
          isStopCommand(text)
        ) {

          stopSpeaking();

          continue;
        }


        message.textContent =
          `「${text}」`;


        await sendToJarvis(text);
      }
    };


  // ======================================
  // 認識エラー
  // ======================================

  r.onerror =
    (event) => {

      console.log(
        "SPEECH ERROR:",
        event.error
      );


      listening =
        false;


      if (
        event.error ===
        "not-allowed"
      ) {

        shouldListen =
          false;


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


      if (shouldListen) {

        restartRecognition();
      }
    };


  // ======================================
  // 認識終了
  // ======================================

  r.onend =
    () => {

      listening =
        false;


      console.log(
        "SPEECH END"
      );


      if (shouldListen) {

        restartRecognition();
      }
    };


  return r;
}


// ========================================
// 音声認識開始
// ========================================

function startRecognition() {

  if (!SpeechRecognition) {

    message.textContent =
      "このSafariでは音声入力を利用できません";

    statusText.textContent =
      "音声認識非対応";

    return;
  }


  if (listening) {
    return;
  }


  if (restarting) {
    return;
  }


  try {

    if (!recognition) {

      recognition =
        createRecognition();
    }


    if (!recognition) {
      return;
    }


    recognition.start();

    listening =
      true;


    statusText.textContent =
      "🎙️ 聞いています...";


    if (talkButton) {

      talkButton.textContent =
        "🔴 聞いています";
    }


    console.log(
      "RECOGNITION START"
    );


  } catch (error) {

    console.log(
      "RECOGNITION START ERROR:",
      error.message
    );


    listening =
      false;
  }
}


// ========================================
// 音声認識再起動
// ========================================

function restartRecognition() {

  if (!shouldListen) {
    return;
  }


  if (restarting) {
    return;
  }


  restarting =
    true;


  setTimeout(
    () => {

      restarting =
        false;


      if (
        shouldListen &&
        !listening
      ) {

        // 認識オブジェクトを作り直す

        recognition =
          createRecognition();


        startRecognition();
      }

    },
    500
  );
}


// ========================================
// JARVISへ送信
// ========================================

async function sendToJarvis(text) {

  if (thinking) {
    return;
  }


  thinking =
    true;


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


    // ====================================
    // ElevenLabs
    // ====================================

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


  thinking =
    false;


  // 音声認識は常時維持

  if (
    shouldListen &&
    !listening
  ) {

    startRecognition();
  }
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

      shouldListen =
        true;


      await unlockAudio();


      startRecognition();
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


    statusText.textContent =
      "🔊 JARVISが話しています";


    // ====================================
    // 音声終了
    // ====================================

    source.onended =
      () => {

        if (
          currentSource ===
          source
        ) {

          currentSource =
            null;
        }


        speaking =
          false;


        statusText.textContent =
          "🎙️ 聞いています...";


        console.log(
          "JARVIS AUDIO END"
        );


        if (
          shouldListen &&
          !listening
        ) {

          startRecognition();
        }
      };


    // ------------------------------------
    // 再生
    // ------------------------------------

    source.start(0);


    console.log(
      "AUDIO PLAY START"
    );


  } catch (error) {

    console.error(
      "AUDIO ERROR:",
      error
    );


    speaking =
      false;


    statusText.textContent =
      "音声再生エラー";


    message.textContent =
      message.textContent +
      "\n\n音声再生エラー：\n" +
      error.message;


    if (
      shouldListen &&
      !listening
    ) {

      startRecognition();
    }
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