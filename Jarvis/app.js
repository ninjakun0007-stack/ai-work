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
// ストップ判定
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
    value.includes("止めろ") ||
    value.includes("静かに") ||
    value.includes("黙って") ||
    value.includes("もういい") ||
    value.includes("やめて") ||
    value.includes("やめろ") ||
    value.includes("停止") ||
    value.includes("音声停止")
  );
}


// ========================================
// 音声停止
// ========================================

function stopSpeaking() {

  console.log("=== JARVIS STOP ===");

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
    talkButton.textContent = "🎙️ 話す";
  }

  if (stopButton) {
    stopButton.style.display = "block";
  }

  statusText.textContent =
    "🔇 停止しました";

  message.textContent =
    "JARVISを停止しました";

  setTimeout(() => {

    manualStop = false;

    if (conversationStarted) {
      startListening();
    }

  }, 700);
}


// ========================================
// JARVIS回答
// ========================================

function getJarvisReply(text) {

  const value = text.trim();

  if (isStopCommand(value)) {
    return "";
  }


  if (
    value.includes("こんにちは") ||
    value.includes("こんばんは") ||
    value.includes("おはよう")
  ) {

    return "はい。JARVISです。ご用件をどうぞ。";
  }


  if (
    value.includes("名前") ||
    value.includes("あなたは誰")
  ) {

    return "私はJARVISです。あなたの仕事をお手伝いするAIシステムです。";
  }


  if (
    value.includes("元気") ||
    value.includes("調子")
  ) {

    return "はい。正常に稼働しています。";
  }


  if (
    value.includes("何時") ||
    value.includes("時間")
  ) {

    const now = new Date();

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


  if (
    value.includes("求人") ||
    value.includes("仕事")
  ) {

    return "求人検索機能ですね。現在は0円版JARVISとして動作しています。";
  }


  if (
    value.includes("検索") ||
    value.includes("調べて")
  ) {

    return "検索機能ですね。現在は0円版JARVISとして動作しています。";
  }


  if (
    value.includes("テスト")
  ) {

    return "はい。JARVISは正常に動作しています。";
  }


  if (
    value.includes("終了")
  ) {

    conversationStarted = false;

    return "了解しました。待機状態に戻ります。";
  }


  return "「" + value + "」と認識しました。";
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
    new SpeechSynthesisUtterance(text);

  utterance.lang = "ja-JP";
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;


  utterance.onstart = () => {

    speaking = true;

    console.log(
      "JARVIS SPEAKING"
    );

    statusText.textContent =
      "🔊 JARVISが話しています";

    if (stopButton) {
      stopButton.style.display = "block";
    }

    if (talkButton) {
      talkButton.textContent =
        "🔊 話しています";
    }

    // 話している最中も認識を開始
    startListening();
  };


  utterance.onend = () => {

    speaking = false;

    console.log(
      "JARVIS SPEECH END"
    );

    if (!manualStop) {

      statusText.textContent =
        "待機中";

      if (talkButton) {
        talkButton.textContent =
          "🎙️ 話す";
      }

      if (conversationStarted) {
        setTimeout(() => {
          startListening();
        }, 300);
      }
    }
  };


  utterance.onerror = (event) => {

    console.log(
      "SPEECH ERROR:",
      event.error
    );

    speaking = false;

    if (!manualStop) {

      statusText.textContent =
        "音声エラー";

      if (conversationStarted) {
        setTimeout(() => {
          startListening();
        }, 300);
      }
    }
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


  r.lang = "ja-JP";

  r.continuous = true;

  r.interimResults = true;

  r.maxAlternatives = 1;


  r.onresult = (event) => {

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

      console.log(
        "VOICE:",
        text
      );


      // ★最優先
      // ストップなら即停止
      if (isStopCommand(text)) {

        console.log(
          "STOP COMMAND DETECTED"
        );

        stopSpeaking();

        return;
      }


      // JARVISが話している最中は
      // 普通の回答処理をしない
      if (speaking) {
        continue;
      }


      // 確定結果だけ処理
      if (!result.isFinal) {
        continue;
      }


      if (!text) {
        continue;
      }


      message.textContent =
        "「" + text + "」";

      statusText.textContent =
        "JARVISが考えています...";


      const reply =
        getJarvisReply(text);


      if (!reply) {
        return;
      }


      message.textContent =
        reply;

      speak(reply);

      return;
    }
  };


  r.onerror = (event) => {

    console.log(
      "RECOGNITION ERROR:",
      event.error
    );

    listening = false;

    recognition = null;


    if (
      event.error === "not-allowed"
    ) {

      statusText.textContent =
        "マイク許可が必要です";

      message.textContent =
        "Safariのマイク許可を確認してください";

      return;
    }


    if (
      conversationStarted
    ) {

      setTimeout(() => {

        if (
          conversationStarted &&
          !listening
        ) {

          startListening();

        }

      }, 500);
    }
  };


  r.onend = () => {

    console.log(
      "RECOGNITION END"
    );

    listening = false;

    recognition = null;


    if (
      conversationStarted &&
      !manualStop
    ) {

      setTimeout(() => {

        if (
          conversationStarted &&
          !listening
        ) {

          startListening();

        }

      }, 300);
    }
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

    statusText.textContent =
      "音声認識非対応";

    return;
  }


  if (
    listening ||
    starting
  ) {

    return;
  }


  try {

    starting = true;


    recognition =
      createRecognition();


    if (!recognition) {

      throw new Error(
        "音声認識を作成できません"
      );
    }


    listening = true;


    if (!speaking) {

      message.textContent =
        "お話しください";

      statusText.textContent =
        "🎙️ 聞いています...";

    }


    recognition.start();


  } catch (error) {

    console.log(
      "MIC ERROR:",
      error.message
    );

    listening = false;

    recognition = null;

  } finally {

    starting = false;
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

      manualStop = false;

      // iPhone Safariの音声機能を
      // ユーザー操作で解除

      window.speechSynthesis.cancel();

      const unlock =
        new SpeechSynthesisUtterance("");

      unlock.lang =
        "ja-JP";

      unlock.volume =
        0;

      window.speechSynthesis.speak(
        unlock
      );


      if (speaking) {

        stopSpeaking();

        return;
      }


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

      manualStop = false;

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