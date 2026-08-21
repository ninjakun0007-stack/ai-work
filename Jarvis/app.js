const talkButton = document.getElementById("talkButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  message.textContent = "このSafariでは音声入力を利用できません";
  statusText.textContent = "音声認識非対応";
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

      message.textContent = "お話しください";
      statusText.textContent = "聞いています...";
      talkButton.textContent = "🔴 聞いています";

      recognition.start();
    } catch (error) {
      listening = false;
      message.textContent = "音声入力を開始できませんでした";
      statusText.textContent = error.message || "開始エラー";
      talkButton.textContent = "🎙️ 話す";
    }
  });

  recognition.onstart = () => {
    listening = true;
    statusText.textContent = "聞いています...";
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;

    message.textContent = `「${text}」`;
    statusText.textContent = "音声を受け取りました";
  };

  recognition.onerror = (event) => {
    listening = false;

    message.textContent = "音声入力エラー";
    statusText.textContent = event.error || "unknown error";
    talkButton.textContent = "🎙️ 話す";
  };

  recognition.onend = () => {
    listening = false;
    talkButton.textContent = "🎙️ 話す";

    if (statusText.textContent === "聞いています...") {
      statusText.textContent = "音声入力が終了しました";
    }
  };
}