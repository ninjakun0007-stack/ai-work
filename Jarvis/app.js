const talkButton = document.getElementById("talkButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

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

      message.textContent =
        "音声入力を開始できませんでした";

      statusText.textContent =
        error.message || "開始エラー";

      talkButton.textContent = "🎙️ 話す";
    }
  });


  recognition.onresult = (event) => {

    const text =
      event.results[0][0].transcript.trim();

    message.textContent = `「${text}」`;

    let query = "";


    // ========================================
    // 検索ワードを取り出す
    // ========================================

    if (text.startsWith("検索して")) {

      query = text
        .replace("検索して", "")
        .trim();

    } else if (text.startsWith("検索")) {

      query = text
        .replace("検索", "")
        .trim();

    } else if (text.includes("を検索")) {

      query = text
        .split("を検索")[0]
        .trim();

    } else if (text.includes("調べて")) {

      query = text
        .replace("調べて", "")
        .trim();
    }


    // ========================================
    // 検索
    // ========================================

    if (query) {

      const searchURL =
        "./search-api.html?q=" +
        encodeURIComponent(query);


      message.innerHTML =
        `「${query}」を検索します。<br><br>` +
        `<a href="${searchURL}" ` +
        `style="display:inline-block;` +
        `padding:15px 25px;` +
        `background:#ffffff;` +
        `color:#000000;` +
        `border-radius:10px;` +
        `text-decoration:none;` +
        `font-size:18px;">` +
        `🔎 検索結果を開く` +
        `</a>`;


      statusText.textContent =
        "検索準備完了";

      return;
    }


    // ========================================
    // 通常のJARVIS回答
    // ========================================

    statusText.textContent =
      "JARVISが考えています...";

    const reply =
      getJarvisReply(text);


    setTimeout(() => {

      message.textContent = reply;

      statusText.textContent =
        "JARVIS応答";

      speak(reply);

    }, 300);
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
// JARVIS通常回答
// ========================================

function getJarvisReply(text) {

  const now = new Date();


  if (
    text.includes("こんにちは") ||
    text.includes("こんばんは") ||
    text.includes("おはよう")
  ) {

    return "こんにちは。JARVISです。今日は何をお手伝いしましょうか？";
  }


  if (
    text.includes("名前") ||
    text.includes("誰")
  ) {

    return "私の名前はJ.A.R.V.I.S.です。";
  }


  if (
    text.includes("元気") ||
    text.includes("調子") ||
    text.includes("状態")
  ) {

    return "はい。システムは正常に稼働しています。";
  }


  if (
    text.includes("何時") ||
    text.includes("時間") ||
    text.includes("現在時刻")
  ) {

    return `現在の時刻は、${now.getHours()}時${now.getMinutes()}分です。`;
  }


  if (
    text.includes("何日") ||
    text.includes("今日の日付") ||
    text.includes("今日は何日")
  ) {

    return `今日は${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日です。`;
  }


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


  if (
    text.includes("ありがとう") ||
    text.includes("感謝")
  ) {

    return "どういたしまして。いつでもお呼びください。";
  }


  if (
    text.includes("何ができる") ||
    text.includes("何ができますか") ||
    text.includes("できること")
  ) {

    return "時刻、日付、曜日、簡単な計算、インターネット検索に対応しています。";
  }


  // ========================================
  // 簡単な計算
  // ========================================

  const calculation =
    text.match(
      /(-?\d+(?:\.\d+)?)\s*(たす|足す|\+|引く|ひく|マイナス|掛ける|かける|×|割る|わる|÷)\s*(-?\d+(?:\.\d+)?)/
    );


  if (calculation) {

    const a = Number(calculation[1]);
    const operator = calculation[2];
    const b = Number(calculation[3]);


    if (
      operator === "たす" ||
      operator === "足す" ||
      operator === "+"
    ) {

      return `${a}足す${b}は${a + b}です。`;
    }


    if (
      operator === "引く" ||
      operator === "ひく" ||
      operator === "マイナス"
    ) {

      return `${a}引く${b}は${a - b}です。`;
    }


    if (
      operator === "掛ける" ||
      operator === "かける" ||
      operator === "×"
    ) {

      return `${a}掛ける${b}は${a * b}です。`;
    }


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


  return `「${text}」ですね。検索したい場合は「検索して」と言ってください。`;
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
  utterance.rate = 0.9;
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


  window.speechSynthesis.speak(utterance);
}