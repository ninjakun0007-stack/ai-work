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
let stopActive = false;


// ========================================
// ストップ判定
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

  console.log("JARVIS STOP");

  window.speechSynthesis.cancel();

  speaking = false;

  stopStopRecognition();

  statusText.textContent =
    "🔇 停止しました";

  message.textContent =
    "JARVISの音声を停止しました";

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

    return "現在の時刻は" +
      now.toLocaleTimeString(
        "ja-JP",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      ) +
      "です。";
  }


  if (
    value.includes("今日") &&
    (
      value.includes("何日") ||
      value.includes("日付")
    )
  ) {

    const now = new Date();

    return "今日は" +
      now.toLocaleDateString(
        "ja-JP"
      ) +
      "です。";
  }


  if (
    value.includes("天気") ||
    value.includes("気温") ||
    value.includes("降水確率")
  ) {

    return "現在の0円版JARVISでは、リアルタイム天気にはまだ接続していません。";
  }


  if (
    value.includes("求人") ||
    value.includes("仕事を探して") ||
    value.includes("仕事探して")
  ) {

    return "求人検索機能は、無料で使える検索システムとして次の段階で追加できます。";
  }


  if (
    value.includes("検索") ||
    value.includes("調べて")
  ) {

    return "Web検索機能は、次の段階で無料構成に追加できます。";
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


  return "「" +
    value +
    "」と認識しました。現在は0円版JARVISとして動作しています。";
}


// ========================================
// iPhone標準音声
// ========================================

function speak(text) {

  if (!text) {
    return;
  }

  console.log(
    "SPEAK:",
    text
  );

  // 前の音声を停止
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


  utterance.onstart =
    () => {

      console.log(
        "SPEECH START"
      );

      speaking = true;

      statusText.textContent =
        "🔊 JARVISが話しています";

      startStopRecognition();
    };


  utterance.onend =
    () => {

      console.log(
        "SPEECH END"
      );

      speaking = false;

      stopStopRecognition();

      statusText.textContent =
        "待機中";

      restartListening();
    };


  utterance.onerror =
    (event) => {

      console.log(
        "SPEECH ERROR:",
        event.error
      );

      speaking = false;

      stopStopRecognition();

      statusText.textContent =
        "音声エラー";

      restartListening();
    };


  // iPhone Safari対策
  setTimeout(() => {

    window.speechSynthesis.speak(
      utterance
    );

  }, 100);
}


// ========================================
// ストップ専用認識
// ========================================

function startStopRecognition() {

  if (!SpeechRecognition) {
    return;
  }

  if (stopActive) {
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


          if (
            isStopCommand(text)
          ) {

            stopSpeaking();

            return;
          }
        }
      };


    stopRecognition.onerror =
      (event) => {

        console.log(
          "STOP ERROR:",
          event.error
        );

        stopActive = false;
      };


    stopRecognition.onend =
      () => {

        stopActive = false;

        if (speaking) {

          setTimeout(() => {

            startStopRecognition();

          }, 300);
        }
      };


    stopRecognition.start();

    stopActive = true;

  } catch (error) {

    console.log(
      "STOP START ERROR:",
      error.message
    );

    stopActive = false;
  }
}


// ========================================
// ストップ認識終了
// ========================================

function stopStopRecognition() {

  if (!stopRecognition) {
    return;
  }

  try {

    stopRecognition.stop();

  } catch (_) {}

  stopRecognition = null;

  stopActive = false;
}


// ========================================
// 通常音声認識
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

      listening = false;


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

        restartListening();

        return;
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


      // 必ず音声にする
      speak(reply);
    };


  r.onerror =
    (event) => {

      listening = false;

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


      if (
        event.error ===
        "aborted"
      ) {

        return;
      }


      statusText.textContent =
        "音声入力エラー";

      restartListening();
    };


  r.onend =
    () => {

      listening = false;

      if (
        talkButton &&
        !speaking
      ) {

        talkButton.textContent =
          "🎙️ 話す";
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


  } catch (error) {

    console.log(
      "MIC ERROR:",
      error.message
    );

    listening = false;

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
      conversationStarted &&
      !speaking &&
      !listening
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
    () => {

      conversationStarted = true;

      if (speaking) {

        stopSpeaking();

        return;
      }

      startListening();
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
  }
);