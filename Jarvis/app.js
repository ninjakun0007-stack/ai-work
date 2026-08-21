const talkButton = document.getElementById("talkButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  message.textContent = "音声入力に対応していません";
  statusText.textContent = "ブラウザを確認してください";
} else {
  const recognition = new SpeechRecognition();

  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = false;

  talkButton.addEventListener("click", () => {
    message.textContent = "お話しください";
    statusText.textContent = "音声入力中...";
    talkButton.textContent = "🔴 聞いています";

    recognition.start();
  });

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;

    message.textContent = `「${text}」`;
    statusText.textContent = "音声を受け取りました";
  };

  recognition.onerror = () => {
    message.textContent = "もう一度お話しください";
    statusText.textContent = "音声入力エラー";
    talkButton.textContent = "🎙️ 話す";
  };

  recognition.onend = () => {
    talkButton.textContent = "🎙️ 話す";
  };
}