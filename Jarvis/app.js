const talkButton = document.getElementById("talkButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const WORKER_URL =
  "https://jarvis-voice.ninjakun0007.workers.dev";

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


// ========================================
// iPhone Safari 音声再生用
// ========================================

let audioContext = null;

function unlockAudio() {

  try {

    if (!audioContext) {

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) {
        return;
      }

      audioContext =
        new AudioContext();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // 無音音声を一瞬再生して
    // iPhone Safariの音声再生をアンロック
    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    gain.gain.value = 0;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + 0.01
    );

  } catch (error) {

    console.log(
      "Audio unlock:",
      error
    );
  }
}


// ========================================
// 音声認識
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

  let listening = false;


  // ======================================
  // 話すボタン
  // ======================================

  talkButton.addEventListener(
    "click",
    () => {

      if (listening) {
        return;
      }

      // iPhone Safariの音声再生を
      // ユーザー操作中にアンロック
      unlockAudio();

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


        if (!response.ok) {

          const errorMessage =
            data?.error?.error?.message ||
            data?.error?.message ||
            JSON.stringify(data?.error) ||
            `HTTP ${response.status}`;

          throw new Error(
            errorMessage
          );
        }


        const reply =
          data.reply ||
          "申し訳ありません。回答を取得できませんでした。";


        message.textContent =
          reply;


        // ==================================
        // ElevenLabs音声
        // ==================================

        if (data.audio) {

          statusText.textContent =
            "🔊 JARVISが話しています";

          await playElevenLabsAudio(
            data.audio
          );

        } else {

          // ElevenLabs音声が返らない場合
          // 標準音声へフォールバック

          statusText.textContent =
            "JARVIS応答";

          speakFallback(reply);
        }


      } catch (error) {

        console.error(
          "JARVIS ERROR:",
          error
        );

        message.textContent =
          "エラー：" +
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
// Web Audio API版
// ========================================

async function playElevenLabsAudio(
  base64Audio
) {

  try {

    if (!audioContext) {

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) {

        throw new Error(
          "Web Audio API非対応"
        );
      }

      audioContext =
        new AudioContext();
    }


    // Safariで停止していたら再開
    if (
      audioContext.state ===
      "suspended"
    ) {

      await audioContext.resume();
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


    // MP3をAudioBufferへ変換
    const audioBuffer =
      await audioContext.decodeAudioData(
        bytes.buffer.slice(0)
      );


    // 音源を作成
    const source =
      audioContext.createBufferSource();

    source.buffer =
      audioBuffer;


    // 音量
    const gain =
      audioContext.createGain();

    gain.gain.value =
      1.0;


    source.connect(gain);

    gain.connect(
      audioContext.destination
    );


    source.onended =
      () => {

        statusText.textContent =
          "待機中";
      };


    // 再生
    source.start(0);


  } catch (error) {

    console.error(
      "ElevenLabs audio error:",
      error
    );


    statusText.textContent =
      "音声再生エラー";


    // 念のため標準音声へ
    // ただし自動再生制限で
    // 再生できない場合があります

    return;
  }
}


// ========================================
// 予備：iPhone標準音声
// ========================================

function speakFallback(text) {

  if (
    !("speechSynthesis" in window)
  ) {

    statusText.textContent =
      "音声読み上げ非対応";

    return;
  }


  window.speechSynthesis.cancel();


  const utterance =
    new SpeechSynthesisUtterance(
      text
    );


  utterance.lang =
    "ja-JP";

  utterance.rate =
    0.95;

  utterance.pitch =
    1.0;

  utterance.volume =
    1.0;


  utterance.onstart =
    () => {

      statusText.textContent =
        "🔊 JARVISが話しています";
    };


  utterance.onend =
    () => {

      statusText.textContent =
        "待機中";
    };


  utterance.onerror =
    () => {

      statusText.textContent =
        "読み上げエラー";
    };


  window.speechSynthesis.speak(
    utterance
  );
}