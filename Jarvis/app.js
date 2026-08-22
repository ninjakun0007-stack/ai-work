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
    statusText.textContent = "JARVISが考えています...";

    const reply = getJarvisReply(text);

    setTimeout(() => {
      message.textContent = reply;
      statusText.textContent = "JARVIS応答";

      speak(reply);
    }, 300);
  };

  recognition.onerror = (event) => {
    listening = false;

    message.textContent = "もう一度お話しください";
    statusText.textContent =
      event.error || "音声入力エラー";

    talkButton.textContent = "🎙️ 話す";
  };

  recognition.onend = () => {
    listening = false;
    talkButton.textContent = "🎙️ 話す";
  };
}


// ========================================
// JARVIS 無料版・簡単質問システム
// ========================================

function getJarvisReply(text) {

  const now = new Date();

  // ----------------
  // あいさつ
  // ----------------

  if (
    text.includes("こんにちは") ||
    text.includes("こんばんは") ||
    text.includes("おはよう")
  ) {
    return "こんにちは。JARVISです。今日は何をお手伝いしましょうか？";
  }


  // ----------------
  // 名前
  // ----------------

  if (
    text.includes("名前") ||
    text.includes("誰")
  ) {
    return "私の名前はJ.A.R.V.I.S.です。";
  }


  // ----------------
  // 元気・状態
  // ----------------

  if (
    text.includes("元気") ||
    text.includes("調子") ||
    text.includes("状態")
  ) {
    return "はい。システムは正常に稼働しています。";
  }


  // ----------------
  // 現在時刻
  // ----------------

  if (
    text.includes("何時") ||
    text.includes("時間") ||
    text.includes("現在時刻")
  ) {

    const hour = now.getHours();
    const minute = now.getMinutes();

    return `現在の時刻は、${hour}時${minute}分です。`;
  }


  // ----------------
  // 今日の日付
  // ----------------

  if (
    text.includes("何日") ||
    text.includes("今日の日付") ||
    text.includes("今日は何日")
  ) {

    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();

    return `今日は${year}年${month}月${date}日です。`;
  }


  // ----------------
  // 曜日
  // ----------------

  if (
    text.includes("何曜日") ||
    text.includes("曜日")
  ) {

    const days = [
      "日曜日",
      "月曜日",
      "火曜日",
      "水曜日",
      "木曜日",
      "金曜日",
      "土曜日"
    ];

    return `今日は${days[now.getDay()]}です。`;
  }


  // ----------------
  // ありがとう
  // ----------------

  if (
    text.includes("ありがとう") ||
    text.includes("感謝")
  ) {
    return "どういたしまして。いつでもお呼びください。";
  }


  // ----------------
  // 何ができる？
  // ----------------

  if (
    text.includes("何ができる") ||
    text.includes("何ができますか") ||
    text.includes("できること")
  ) {

    return "現在、時刻、日付、曜日、簡単な計算、挨拶などに対応しています。";
  }


  // ========================================
  // 簡単な計算
  // ========================================

  const calculation = text.match(
    /(-?\d+(?:\.\d+)?)\s*(たす|足す|\+|引く|ひく|マイナス|掛ける|かける|×|割る|わる|÷)\s*(-?\d+(?:\.\d+)?)/
  );

  if (calculation) {

    const a = Number(calculation[1]);
    const operator = calculation[2];
    const b = Number(calculation[3]);

    // 足し算
    if (
      operator === "たす" ||
      operator === "足す" ||
      operator === "+"
    ) {

      return `${a}足す${b}は${a + b}です。`;
    }


    // 引き算
    if (
      operator === "引く" ||
      operator === "ひく" ||
      operator === "マイナス"
    ) {

      return `${a}引く${b}は${a - b}です。`;
    }


    // 掛け算
    if (
      operator === "掛ける" ||
      operator === "かける" ||
      operator === "×"
    ) {

      return `${a}掛ける${b}は${a * b}です。`;
    }


    // 割り算
    if (
      operator === "割る" ||
      operator === "わる" ||
      operator === "÷"
    ) {

      if (b === 0) {
        return "0では割ることができません。";
      }

      return `${a}割る${b}は${a / b}です。`;
    }
  }


  // ----------------
  // 未対応の質問
  // ----------------

  return `「${text}」ですね。現在は、時刻、日付、曜日、簡単な計算などに対応しています。`;
}


// ========================================
// 音声読み上げ
// ========================================

function speak(text) {

  if (!("speechSynthesis" in window)) {
    statusText.textContent = "音声読み上げ非対応";
    return;
  }

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "ja-JP";
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    statusText.textContent = "🔊 JARVISが話しています";
  };

  utterance.onend = () => {
    statusText.textContent = "待機中";
  };

  utterance.onerror = () => {
    statusText.textContent = "読み上げエラー";
  };

  window.speechSynthesis.speak(utterance);
}