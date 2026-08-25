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

        throw new Error(
          data.error
            ? JSON.stringify(data.error)
            : "Worker error"
        );
      }


      const reply =
        data.reply ||
        "申し訳ありません。回答を取得できませんでした。";


      message.textContent =
        reply;

      statusText.textContent =
        "JARVIS応答";

      speak(reply);

    } catch (error) {

      console.error(error);

      message.textContent =
        "AIとの接続に失敗しました";

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
// 音声読み上げ
// ========================================

function speak(text) {

  if (!("speechSynthesis" in window)) {

    statusText.textContent =
      "音声読み上げ非対応";

    return;
  }


  window.speechSynthesis.cancel();


  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "ja-JP";

  utterance.rate = 0.95;

  utterance.pitch = 1.0;

  utterance.volume = 1.0;


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