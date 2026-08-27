// ========================================
// J.A.R.V.I.S. 0円版
// OpenAI / ElevenLabs / Worker 不使用
// ========================================

const talkButton = document.getElementById("talkButton");
const audioTestButton = document.getElementById("audioTestButton");
const message = document.getElementById("message");
const statusText = document.getElementById("statusText");

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;
let stopRecognition = null;

let listening = false;
let speaking = false;
let conversationStarted = false;
let starting = false;
let stopListenerActive = false;


// ========================================
// ストップ命令
// ========================================

function isStopCommand(text) {

  const value = String(text || "")
    .trim()
    .replace(/[！!。．、,？?]/g, "");

  const commands = [
    "ストップ",
    "止まって",
    "止まれ",
    "止めて",
    "止めろ",
    "静かに",
    "黙って",
    "もういい",
    "やめて",
    "やめろ",
    "停止",
    "音声停止"
  ];

  return commands.some(command =>
    value.includes(command)
  );
}


// ========================================
// 音声停止
// ========================================

function stopSpeaking() {

  console.log("STOP");

  // iPhone標準音声を即停止
  window.speechSynthesis.cancel();

  speaking = false;

  stopStopRecognition();

  statusText.textContent = "🔇 停止しました";
  message.textContent = "JARVISの音声を停止しました";

  // 会話モードなら再び聞く
  if (conversationStarted) {

    setTimeout(() => {
      startListening();
    }, 500);
  }
}


// ========================================
// JARVIS回答
// ========================================

function getJarvisReply(text) {

  const value = text.trim();

  // -----------------------------
  // ストップ
  // -----------------------------

  if (isStopCommand(value)) {
    return "";
  }


  // -----------------------------
  // 挨拶
  // -----------------------------

  if (
    value.includes("こんにちは") ||
    value.includes("こんばんは") ||
    value.includes("おはよう")
  ) {

    return "はい。JARVISです。ご用件をどうぞ。";
  }


  // -----------------------------
  // 名前
  // -----------------------------

  if (
    value.includes("名前") ||
    value.includes("あなたは誰")
  ) {

    return "私はJARVISです。あなたの指示をお手伝いします。";
  }


  // -----------------------------
  // 時刻
  // -----------------------------

  if (
    value.includes("何時") ||
    value.includes("時間")
  ) {

    const now = new Date();

    return `現在の時刻は${now.toLocaleTimeString(
      "ja-JP",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    )}です。`;
  }


  // -----------------------------
  // 日付
  // -----------------------------

  if (
    value.includes("今日") &&
    (
      value.includes("何日") ||
      value.includes("日付") ||
      value.includes("年月日")
    )
  ) {

    const now = new Date();

    return `今日は${now.toLocaleDateString(
      "ja-JP"
    )}です。`;
  }


  // -----------------------------
  // 天気
  // -----------------------------

  if (
    value.includes("天気") ||
    value.includes("気温") ||
    value.includes("降水確率")
  ) {

    return "リアルタイムの天気情報は、現在の0円版JARVISでは取得していません。Web検索機能を追加すれば取得できるようにできます。";
  }


  // -----------------------------
  // 求人
  // -----------------------------

  if (
    value.includes("求人") ||
    value.includes("仕事を探して") ||
    value.includes("仕事探して")
  ) {

    return "求人検索機能を呼び出す準備はできています。無料で利用できる求人検索方法を次の段階で追加できます。";
  }


  // -----------------------------
  // 検索
  // -----------------------------

  if (
    value.includes("検索して") ||
    value.includes("検索") ||
    value.includes("調べて")
  ) {

    return "Web検索機能は次の段階で無料構成に変更できます。";
  }


  // -----------------------------
  // テスト
  // -----------------------------

  if (
    value.includes("テスト")
  ) {

    return "はい。JARVISの音声システムは正常に動作しています。";
  }


  // -----------------------------
  // 終了
  // -----------------------------

  if (
    value.includes("終了") ||
    value.includes("バイバイ")
  ) {

    conversationStarted = false;

    return "了解しました。待機状態に戻ります。";
  }


  // -----------------------------
  // デフォルト
  // -----------------------------

  return `「${value}」と認識しました。現在は0円版のため、外部AIを使わずに基本的な処理を行っています。`;
}


// ========================================
// 音声読み上げ
// ========================================

function speak(text) {

  if (!text) {
    return;
  }

  // 前の音声を完全停止
  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "ja-JP";

  // 自然な速度
  utterance.rate = 0.95;

  utterance.pitch = 1.0;

  utterance.volume = 1.0;


  utterance.onstart = () => {

    speaking = true;

    statusText.textContent =
      "🔊 JARVISが話しています";

    startStopRecognition();
  };


  utterance.onend = () => {

    speaking = false;

    stopStopRecognition();

    statusText.textContent =
      "待機中";

    restartListening();
  };


  utterance.onerror = (event) => {

    console.log(
      "SPEECH ERROR:",
      event
    );

    speaking = false;

    stopStopRecognition();

    statusText.textContent =
      "待機中";

    restartListening();
  };


  window.speechSynthesis.speak(
    utterance
  );
}


// ========================================
// ストップ専用音声認識
// ========================================

function startStopRecognition() {

  if (!SpeechRecognition) {
    return;
  }

  if (stopListenerActive) {
    return;
  }

  try {

    stopRecognition =
      new SpeechRecognition();

    stopRecognition.lang =
      "ja-JP";

    stopRecognition.continuous =
      true;

    stopRecognition.interimResults =
      true;

    stopRecognition.maxAlternatives =
      1;


    stopRecognition.onresult =
      (event) => {

        for (
          let i = event.resultIndex;
          i < event.results.length;
          i++
        ) {

          const text =
            event.results[i][0]
              .transcript
              .trim();

          console.log(
            "STOP LISTENER:",
            text
          );

          if (isStopCommand(text)) {

            stopSpeaking();

            return;
          }
        }
      };


    stopRecognition.onerror =
      (event) => {

        console.log(
          "STOP LISTENER ERROR:",
          event.error
        );

        stopListenerActive = false;
      };


    stopRecognition.onend =
      () => {

        stopListenerActive = false;

        if (speaking) {

          setTimeout(() => {

            startStopRecognition();

          }, 300);
        }
      };


    stopRecognition.start();

    stopListenerActive = true;

    console.log(
      "STOP LISTENER START"
    );

  } catch (error) {

    console.log(
      "STOP LISTENER START ERROR:",
      error.message
    );

    stopListenerActive = false;
  }
}


// ========================================
// ストップ認識停止
// ========================================

function stopStopRecognition() {

  if (!stopRecognition) {
    return;
  }

  try {

    stopRecognition.stop();

  } catch (_) {}

  stopRecognition = null;

  stopListenerActive = false;
}


// ========================================
// 音声認識作成
// ========================================

function createRecognition() {

  if (!SpeechRecognition) {
    return null;
  }

  const r =
    new SpeechRecognition();

  r.lang = "ja-JP";

  r.continuous = false;

  r.interimResults = false;

  r.maxAlternatives = 1;


  // ======================================
  // 認識結果
  // ======================================

  r.onresult = (event) => {

    listening = false;

    const text =
      event.results[0][0]
        .transcript
        .trim();

    console.log(
      "USER:",
      text
    );


    // ストップ
    if (isStopCommand(text)) {

      stopSpeaking();

      return;
    }


    if (!text) {

      restartListening();

      return;
    }


    message.textContent =
      `「${text}」`;

    statusText.textContent =
      "JARVISが考えています...";


    // 0円版JARVIS回答
    const reply =
      getJarvisReply(text);


    if (!reply) {
      return;
    }


    message.textContent =
      reply;


    // 少し間をあけて読み上げ
    setTimeout(() => {

      speak(reply);

    }, 200);
  };


  // ======================================
  // エラー
  // ======================================

  r.onerror = (event) => {

    listening = false;

    console.log(
      "RECOGNITION ERROR:",
      event.error
    );


    if (
      event.error === "not-allowed"
    ) {

      statusText.textContent =
        "マイク許可が必要です";

      message.textContent =
        "Safariのマイク許可を確認してください";

      if (talkButton) {
        talkButton.textContent =
          "🎙️ 話す";
      }

      return;
    }


    if (
      event.error === "aborted"
    ) {

      return;
    }


    statusText.textContent =
      "音声入力エラー";


    restartListening();
  };


  // ======================================
  // 認識終了
  // ======================================

  r.onend = () => {

    listening = false;

    if (
      talkButton &&
      !speaking
    ) {

      talkButton.textContent =
        "🎙️ 話す";
    }

    console.log(
      "RECOGNITION END"
    );
  };


  return r;
}


// ========================================
// マイク開始
// ========================================

async function startListening() {

  if (!SpeechRecognition) {

    message.textContent =
      "このSafariでは音声入力を利用できません";

    statusText.textContent =
      "音声認識非対応";

    return;
  }


  if (
    listening ||
    starting ||
    speaking
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

    message.textContent =
      "お話しください";

    statusText.textContent =
      "🎙️ 聞いています...";


    if (talkButton) {

      talkButton.textContent =
        "🔴 聞いています";
    }


    recognition.start();

    console.log(
      "MIC START"
    );

  } catch (error) {

    console.error(
      "MIC START ERROR:",
      error
    );

    listening = false;

    if (talkButton) {

      talkButton.textContent =
        "🎙️ 話す";
    }

    statusText.textContent =
      "待機中";

  } finally {

    starting = false;
  }
}


// ========================================
// 自動再開
// ========================================

function restartListening() {

  if (!conversationStarted) {
    return;
  }

  if (speaking) {
    return;
  }

  setTimeout(() => {

    if (
      !speaking &&
      conversationStarted
    ) {

      startListening();
    }

  }, 800);
}


// ========================================
// 話すボタン
// ========================================

if (talkButton) {

  talkButton.addEventListener(
    "click",
    async () => {

      conversationStarted = true;

      // もし音声が出ていたら停止
      if (speaking) {

        stopSpeaking();

        return;
      }

      await startListening();
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

      window.speechSynthesis.cancel();

      const testText =
        "JARVIS音声テストです。正常に動作しています。";

      message.textContent =
        testText;

      speak(testText);
    }
  );
}


// ========================================
// 初期画面
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
  }
);