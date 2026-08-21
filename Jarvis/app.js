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

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;

    message.textContent = `「${text}」`;
    statusText.textContent = "考えています...";

    const reply = getJarvisReply(text);

    setTimeout(() => {
      message.textContent = reply;
      statusText.textContent = "JARVIS応答中";

      speak(reply);
    }, 500);
  };

  recognition.onerror = (event) => {
    listening = false;

    message.textContent = "もう一度お話しください";
    statusText.textContent = event.error || "音声入力エラー";
    talkButton.textContent = "🎙️ 話す";
  };

  recognition.onend = () => {
    listening = false;
    talkButton.textContent = "🎙️ 話す";
  };
}


// =========================
// JARVIS 無料版の返答
// =========================

function getJarvisReply(text) {
  if (text.includes("こんにちは")) {
    return "こんにちは。JARVISです。今日は何をお手伝いしましょうか？";
  }

  if (text.includes("名前")) {
    return "私の名前はJ.A.R.V.I.S.です。";
  }

  if (text.includes("元気")) {
    return "はい。システムは正常に稼働しています。";
  }

  if (text.includes("ありがとう")) {
    return "どういたしまして。いつでもお呼びください。";
  }

  if (text.includes("時間")) {
    const now = new Date();
    return `現在の時刻は${now.getHours()}時${now.getMinutes()}分です。`;
  }

  return `「${text}」ですね。現在は無料版JARVISなので、登録された質問に対応しています。`;
}


// =========================
// JARVIS 音声読み上げ
// =========================

function speak(text) {
  if (!("speechSynthesis" in window)) {
    statusText.textContent = "音声読み上げ非対応";
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "ja-JP";
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    statusText.textContent = "JARVISが話しています";
  };

  utterance.onend = () => {
    statusText.textContent = "待機中";
  };

  window.speechSynthesis.speak(utterance);
}