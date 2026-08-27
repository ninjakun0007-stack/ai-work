const talkButton = document.getElementById("talkButton");
const stopButton = document.getElementById("stopButton");
const audioTestButton = document.getElementById("audioTestButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;

let listening = false;
let speaking = false;
let conversationStarted = false;
let starting = false;
let manualStop = false;


// ========================================
// 停止判定
// ========================================

function isStopCommand(text) {

  const value = String(text || "")
    .trim()
    .replace(/[！!。．、,？?]/g, "")
    .replace(/\s/g, "");

  return (
    value.includes("ストップ") ||
    value.includes("止まって") ||
    value.includes("止まれ") ||
    value.includes("止めて") ||
    value.includes("停止") ||
    value.includes("静かに") ||
    value.includes("黙って") ||
    value.includes("もういい")
  );
}


// ========================================
// Web検索
// ========================================

function searchWeb(text) {

  let query = String(text || "")
    .trim();

  query = query
    .replace(/検索して/g, "")
    .replace(/検索/g, "")
    .replace(/調べて/g, "")
    .trim();


  if (!query) {

    query = "最新ニュース";

  }


  message.textContent =
    "「" + query + "」を検索します";

  statusText.textContent =
    "🔎 Web検索中";


  const url =
    "https://www.google.com/search?q=" +
    encodeURIComponent(query);


  // iPhone Safariで確実に開くため
  // 現在のページを検索ページへ移動

  setTimeout(() => {

    window.location.href =
      url;

  }, 200);

}


// ========================================
// 音声停止
// ========================================

function stopSpeaking() {

  manualStop = true;

  window.speechSynthesis.cancel();

  speaking = false;


  if (recognition) {

    try {
      recognition.abort();
    } catch (_) {}

    recognition = null;

  }


  listening = false;


  if (talkButton) {

    talkButton.textContent =
      "🎙️ 話す";

  }


  statusText.textContent =
    "🔇 停止しました";


  message.textContent =
    "JARVISを停止しました";

}


// ========================================
// JARVIS回答
// ========================================

function getJarvisReply(text) {

  const value =
    text.trim();


  if (isStopCommand(value)) {

    return "";

  }


  // ======================================
  // 検索
  // ======================================

  if (
    value.includes("検索") ||
    value.includes("調べて")
  ) {

    searchWeb(value);

    return "";

  }


  // ======================================
  // あいさつ
  // ======================================

  if (
    value.includes("こんにちは") ||
    value.includes("こんばんは") ||
    value.includes("おはよう")
  ) {

    return "はい。JARVISです。ご用件をどうぞ。";

  }


  // ======================================
  // 名前
  // ======================================

  if (
    value.includes("名前") ||
    value.includes("あなたは誰")
  ) {

    return "私はJARVISです。あなたの仕事をお手伝いします。";

  }


  // ======================================
  // 状態
  // ======================================

  if (
    value.includes("元気") ||
    value.includes("調子")
  ) {

    return "はい。正常に稼働しています。";

  }


  // ======================================
  // 時刻
  // ======================================

  if (
    value.includes("何時") ||
    value.includes("時間")
  ) {

    const now =
      new Date();


    return (
      "現在の時刻は" +
      now.toLocaleTimeString(
        "ja-JP",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      ) +
      "です。"
    );

  }


  // ======================================
  // 求人
  // ======================================

  if (
    value.includes("求人") ||
    value.includes("仕事")
  ) {

    return "求人についてですね。「検索して」と言って条件を指定してください。";

  }


  // ======================================
  // テスト
  // ======================================

  if (
    value.includes("テスト")
  ) {

    return "はい。JARVISは正常に動作しています。";

  }


  // ======================================
  // 終了
  // ======================================

  if (
    value.includes("終了")
  ) {

    conversationStarted =
      false;

    return "了解しました。待機状態に戻ります。";

  }


  return (
    "「" +
    value +
    "」と認識しました。"
  );

}


// ========================================
// 音声再生
// ========================================

function speak(text) {

  if (!text) {
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

      speaking =
        true;


      statusText.textContent =
        "🔊 JARVISが話しています";

    };


  utterance.onend =
    () => {

      speaking =
        false;


      if (!manualStop) {

        statusText.textContent =
          "待機中";


        if (talkButton) {

          talkButton.textContent =
            "🎙️ 話す";

        }

      }

    };


  utterance.onerror =
    () => {

      speaking =
        false;


      statusText.textContent =
        "音声エラー";

    };


  window.speechSynthesis.speak(
    utterance
  );

}


// ========================================
// 音声認識
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


  r.onresult =
    (event) => {

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


      if (
        isStopCommand(text)
      ) {

        stopSpeaking();

        return;

      }


      if (!text) {
        return;
      }


      message.textContent =
        "「" + text + "」";


      const reply =
        getJarvisReply(text);


      if (!reply) {
        return;
      }


      message.textContent =
        reply;


      speak(reply);

    };


  r.onerror =
    (event) => {

      listening =
        false;


      console.log(
        "RECOGNITION ERROR:",
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


        return;

      }


      statusText.textContent =
        "音声入力エラー";

    };


  r.onend =
    () => {

      listening =
        false;

    };


  return r;

}


// ========================================
// マイク開始
// ========================================

function startListening() {

  if (!SpeechRecognition) {

    message.textContent =
      "このSafariでは音声入力を利用できません";

    return;

  }


  if (
    listening ||
    starting
  ) {

    return;

  }


  try {

    starting =
      true;


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

  }

  catch (error) {

    console.log(
      "MIC ERROR:",
      error.message
    );


    listening =
      false;


    recognition =
      null;

  }

  finally {

    starting =
      false;

  }

}


// ========================================
// 話すボタン
// ========================================

if (talkButton) {

  talkButton.addEventListener(
    "click",
    () => {

      conversationStarted =
        true;


      manualStop =
        false;


      window.speechSynthesis.cancel();


      startListening();

    }
  );

}


// ========================================
// 停止ボタン
// ========================================

if (stopButton) {

  stopButton.style.display =
    "block";


  stopButton.addEventListener(
    "click",
    () => {

      stopSpeaking();

    }
  );

}


// ========================================
// 音声テスト
// ========================================

if (audioTestButton) {

  audioTestButton.addEventListener(
    "click",
    () => {

      conversationStarted =
        true;


      manualStop =
        false;


      const text =
        "JARVIS音声テストです。正常に動作しています。";


      message.textContent =
        text;


      speak(text);

    }
  );

}


// ========================================
// 起動
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


    if (stopButton) {

      stopButton.style.display =
        "block";

    }

  }
);