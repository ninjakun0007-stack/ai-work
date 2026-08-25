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

  const recognition = new SpeechRecognition();

  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;

  talkButton.addEventListener("click", () => {

    if (listening) return;

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
        error.message || "開始エラー";

      talkButton.textContent =
        "🎙️ 話す";
    }
  });


  recognition.onresult = async (event) => {

    const text =
      event.results[0][0].transcript.trim();

    message.textContent =
      `「${text}」`;

    if (!text) return;

    statusText.textContent =
      "JARVISが考えています...";

    try {

      const response =
        await fetch(WORKER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text
          })
        });

      const data =
        await response.json();

      if (!response.ok) {

        const errorMessage =
          data?.error?.error?.message ||
          data?.error?.message ||
          JSON.stringify(data?.error) ||
          `HTTP ${response.status}`;

        throw new Error(errorMessage);
      }

      const reply =
        data.reply ||
        "申し訳ありません。回答を取得できませんでした。";

      message.textContent =
        reply;

      statusText.textContent =
        "JARVIS応答";


      // ========================================
      // ElevenLabs音声を再生
      // ========================================

      if (data.audio) {

        statusText.textContent =
          "🔊 JARVISが話しています";

        playElevenLabsAudio(data.audio);

      } else {

        // ElevenLabs音声がない場合は標準音声に戻す
        speakFallback(reply);
      }


    } catch (error) {

      console.error("JARVIS ERROR:", error);

      message.textContent =
        "エラー：" + error.message;

      statusText.textContent =
        "接続エラー";
    }
  };


  recognition.onerror = (event) => {

    listening = false;

    message.textContent =
      "もう一度お話しください";

    statusText.textContent =
      event.error || "音声入力エラー";

    talkButton.textContent =
      "🎙️ 話す";
  };


  recognition.onend = () => {

    listening = false;

    talkButton.textContent =
      "🎙️ 話す";
  };
}


// ========================================
// ElevenLabs音声再生
// ========================================

function playElevenLabsAudio(base64Audio) {

  try {

    const binaryString =
      atob(base64Audio);

    const len =
      binaryString.length;

    const bytes =
      new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] =
        binaryString.charCodeAt(i);
    }

    const blob =
      new Blob(
        [bytes],
        {
          type: "audio/mpeg"
        }
      );

    const audioUrl =
      URL.createObjectURL(blob);

    const audio =
      new Audio(audioUrl);

    audio.volume = 1.0;

    audio.onended = () => {

      URL.revokeObjectURL(audioUrl);

      statusText.textContent =
        "待機中";
    };

    audio.onerror = () => {

      URL.revokeObjectURL(audioUrl);

      statusText.textContent =
        "音声再生エラー";
    };

    audio.play().catch(error => {

      console.error(
        "Audio play error:",
        error
      );

      statusText.textContent =
        "音声再生を開始できませんでした";
    });

  } catch (error) {

    console.error(
      "ElevenLabs audio error:",
      error
    );

    statusText.textContent =
      "音声処理エラー";
  }
}


// ========================================
// ElevenLabsが使えない場合の予備音声
// ========================================

function speakFallback(text) {

  if (!("speechSynthesis" in window)) {

    statusText.textContent =
      "音声読み上げ非対応";

    return;
  }

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang =
    "ja-JP";

  utterance.rate =
    0.95;

  utterance.pitch =
    1.0;

  utterance.volume =
    1.0;

  utterance.onstart = () => {

    statusText.textContent =
      "🔊 JARVISが話しています";
  };

  utterance.onend = () => {

    statusText.textContent =
      "待機中";
  };

  utterance.onerror = () => {

    statusText.textContent =
      "読み上げエラー";
  };

  window.speechSynthesis.speak(
    utterance
  );
}