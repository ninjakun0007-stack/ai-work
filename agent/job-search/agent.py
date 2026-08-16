import os
import json
import re
import requests
from bs4 import BeautifulSoup
from openai import OpenAI


# ============================================================
# 設定
# ============================================================

SOURCE_URL = "https://tech-agent.lancers.jp/project?q_text=Python"

MIN_MONTHLY_PAY = 500000
MIN_AI_SCORE = 80
MIN_AUTOMATION_SCORE = 70

OPENAI_MODEL = "gpt-5-mini"

OUTPUT_FILE = "jobs.json"

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY が設定されていません。")

client = OpenAI(api_key=OPENAI_API_KEY)


# ============================================================
# 案件ページ取得
# ============================================================

def fetch_jobs():

    print("案件ページを取得しています...")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
            "AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        ),
        "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
    }

    response = requests.get(
        SOURCE_URL,
        headers=headers,
        timeout=30
    )

    response.raise_for_status()

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    # 不要部分を削除
    for tag in soup(
        ["script", "style", "noscript"]
    ):
        tag.decompose()

    text = soup.get_text(
        "\n",
        strip=True
    )

    # 空行整理
    lines = []

    for line in text.splitlines():

        line = line.strip()

        if line:
            lines.append(line)

    result = "\n".join(lines)

    print(
        "取得文字数:",
        len(result)
    )

    return result


# ============================================================
# JSON抽出
# ============================================================

def extract_json(text):

    text = text.strip()

    # ```json ... ``` 対応
    if text.startswith("```"):

        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text,
            flags=re.IGNORECASE
        )

        text = re.sub(
            r"\s*```$",
            "",
            text
        )

    text = text.strip()

    # JSON配列
    start = text.find("[")

    end = text.rfind("]")

    if start != -1 and end != -1:

        json_text = text[
            start:end + 1
        ]

        return json.loads(
            json_text
        )

    # JSONオブジェクト
    start = text.find("{")

    end = text.rfind("}")

    if start != -1 and end != -1:

        json_text = text[
            start:end + 1
        ]

        return json.loads(
            json_text
        )

    raise ValueError(
        "AIから有効なJSONを取得できませんでした。"
    )


# ============================================================
# AI案件分析
# ============================================================

def analyze_jobs(page_text):

    print("AIで案件を分析しています...")

    # 巨大な文字列をそのまま渡しすぎない
    page_text = page_text[:50000]

    system_prompt = """
あなたはPython・AI・Web開発案件を選別する求人分析AIです。

案件情報から、Python / AI / Webに関連する案件を抽出してください。

必須条件：

- 月額報酬50万円以上
- AIスコア80以上
- 自動化スコア70以上
- Python / AI / Webとの関連性を重視
- リモートを優先
- フルリモートを最高評価
- ハイブリッドを次に評価
- 常駐は順位を下げる
- AIを活用して開発・分析・文章作成・テスト等を効率化できる案件を高評価
- OpenAI
- Gemini
- RAG
- LangChain
- LlamaIndex
- Hugging Face
- PyTorch
- TensorFlow
- AWS
などを評価する。

重要：

求人情報に書かれていない経験を
「経験済み」と断定してはいけません。

応募メッセージでは、
候補者が実際に経験したと確認できない内容を
事実として書かないでください。

応募候補は「応募文案」として作成してください。

必ずJSONだけを返してください。
Markdownは使用しないでください。
"""

    user_prompt = """
以下の案件情報を分析してください。

検索条件：

Python / AI / Web
月額50万円以上
AIスコア80以上
自動化スコア70以上
リモート優先
AI主体の作業を優先

ランキング重み：

automation = 35%
ai = 25%
remote = 25%
reward = 15%

リモート評価：

フルリモート = 100
完全リモート = 100
リモート可 = 90
ハイブリッド = 80
リモートワーク = 80
一部リモート = 70
不明 = 40
常駐 = 20

以下のJSON配列形式で返してください。

[
  {
    "title": "",
    "reward": "",
    "description": "",
    "remote": "",
    "score": 0,
    "recommended": true,
    "reason": "",
    "monthly_pay": 0,
    "remote_score": 0,
    "automation_score": 0,
    "automation_level": "",
    "automation_reason": "",
    "ai_only_work_fit": 0,
    "ai_automation_breakdown": {
      "AIだけでコード作成しやすい": 0,
      "AIだけで文章/資料作成しやすい": 0,
      "AIによるテスト自動化が可能": 0,
      "AIによるデバッグが可能": 0,
      "APIを利用した自動化が可能": 0,
      "定型作業が多い": 0,
      "オンラインで完結できる": 0,
      "人間による現地作業が少ない": 0,
      "電話対応や対面対応が少ない": 0,
      "資格/本人確認/現場作業への依存が少ない": 0
    },
    "application_candidate": {
      "recommended": true,
      "priority": "",
      "reason": "",
      "application_message": "",
      "questions": []
    }
  }
]

案件情報：

""" + page_text

    response = client.responses.create(
        model=OPENAI_MODEL,
        input=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )

    result_text = response.output_text

    jobs = extract_json(
        result_text
    )

    if not isinstance(jobs, list):
        raise ValueError(
            "AIの結果が配列ではありません。"
        )

    print(
        "AI抽出件数:",
        len(jobs)
    )

    return jobs


# ============================================================
# 数値変換
# ============================================================

def to_number(value):

    if value is None:
        return 0

    if isinstance(value, (int, float)):
        return value

    text = str(value)

    text = text.replace(
        ",",
        ""
    )

    match = re.search(
        r"\d+(?:\.\d+)?",
        text
    )

    if not match:
        return 0

    try:
        return float(
            match.group(0)
        )
    except Exception:
        return 0


# ============================================================
# 報酬から月額を推定
# ============================================================

def normalize_monthly_pay(job):

    value = job.get(
        "monthly_pay",
        0
    )

    value = to_number(
        value
    )

    # AIが万円単位で返した場合
    if 500 <= value < 10000:
        value = value * 10000

    # rewardしかない場合
    if value == 0:

        reward = str(
            job.get(
                "reward",
                ""
            )
        )

        numbers = re.findall(
            r"\d[\d,]*",
            reward
        )

        if numbers:

            try:

                raw = numbers[-1].replace(
                    ",",
                    ""
                )

                value = int(raw)

                if 500 <= value < 10000:
                    value *= 10000

            except Exception:
                value = 0

    return int(value)


# ============================================================
# リモートスコア
# ============================================================

def calculate_remote_score(remote):

    text = str(
        remote or ""
    )

    if (
        "フルリモート" in text
        or "完全リモート" in text
    ):
        return 100

    if "リモート可" in text:
        return 90

    if (
        "ハイブリッド" in text
        or "リモートワーク" in text
    ):
        return 80

    if "一部リモート" in text:
        return 70

    if "常駐" in text:
        return 20

    return 40


# ============================================================
# 自動化スコア
# ============================================================

def calculate_automation_score(job):

    value = job.get(
        "automation_score",
        0
    )

    value = to_number(
        value
    )

    if value > 0:
        return int(
            min(100, value)
        )

    breakdown = job.get(
        "ai_automation_breakdown",
        {}
    )

    values = []

    for value in breakdown.values():

        number = to_number(
            value
        )

        if number > 0:
            values.append(
                number
            )

    if not values:
        return 0

    return int(
        sum(values) / len(values)
    )


# ============================================================
# フィルター
# ============================================================

def filter_jobs(jobs):

    filtered = []

    for job in jobs:

        monthly_pay = normalize_monthly_pay(
            job
        )

        ai_score = int(
            to_number(
                job.get(
                    "score",
                    0
                )
            )
        )

        automation_score = calculate_automation_score(
            job
        )

        if monthly_pay < MIN_MONTHLY_PAY:
            continue

        if ai_score < MIN_AI_SCORE:
            continue

        if automation_score < MIN_AUTOMATION_SCORE:
            continue

        job["monthly_pay"] = monthly_pay

        job["score"] = ai_score

        job["automation_score"] = automation_score

        filtered.append(
            job
        )

    return filtered


# ============================================================
# ランキング
# ============================================================

def rank_jobs(jobs):

    for job in jobs:

        remote_score = calculate_remote_score(
            job.get(
                "remote",
                ""
            )
        )

        pay = int(
            job.get(
                "monthly_pay",
                0
            )
        )

        ai_score = int(
            job.get(
                "score",
                0
            )
        )

        automation_score = int(
            job.get(
                "automation_score",
                0
            )
        )

        # 50万円を0点
        # 110万円以上を100点
        pay_score = (
            (pay - 500000)
            / 600000
            * 100
        )

        pay_score = max(
            0,
            min(
                100,
                pay_score
            )
        )

        ranking_score = (
            automation_score * 0.35
            + ai_score * 0.25
            + remote_score * 0.25
            + pay_score * 0.15
        )

        job["remote_score"] = remote_score

        job["pay_score"] = round(
            pay_score,
            1
        )

        job["ranking_score"] = round(
            ranking_score,
            1
        )

    jobs.sort(
        key=lambda job: job.get(
            "ranking_score",
            0
        ),
        reverse=True
    )

    for index, job in enumerate(
        jobs,
        start=1
    ):
        job["rank"] = index

    return jobs


# ============================================================
# 応募候補数
# ============================================================

def count_application_candidates(jobs):

    count = 0

    for job in jobs:

        candidate = job.get(
            "application_candidate",
            {}
        )

        if candidate.get(
            "recommended",
            False
        ):
            count += 1

    return count


# ============================================================
# jobs.json保存
# ============================================================

def save_jobs(jobs):

    application_count = count_application_candidates(
        jobs
    )

    output = {
        "source": SOURCE_URL,

        "search_conditions": {
            "keyword": "Python / AI / Web",
            "minimum_monthly_pay": MIN_MONTHLY_PAY,
            "minimum_ai_score": MIN_AI_SCORE,
            "minimum_automation_score": MIN_AUTOMATION_SCORE,
            "remote_priority": True,
            "ai_only_work_priority": True
        },

        "ranking_weights": {
            "automation": 0.35,
            "ai": 0.25,
            "remote": 0.25,
            "reward": 0.15
        },

        "count": len(jobs),

        "application_candidate_count": application_count,

        "jobs": jobs
    }

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2
        )

    print(
        "jobs.json を保存しました。"
    )

    print(
        "案件数:",
        len(jobs)
    )

    print(
        "応募候補:",
        application_count
    )


# ============================================================
# Slack通知用テキスト
# ============================================================

def create_slack_message(job):

    title = job.get(
        "title",
        "案件名不明"
    )

    reward = job.get(
        "reward",
        "不明"
    )

    remote = job.get(
        "remote",
        "不明"
    )

    ai_score = job.get(
        "score",
        0
    )

    automation_score = job.get(
        "automation_score",
        0
    )

    ranking_score = job.get(
        "ranking_score",
        0
    )

    monthly_pay = job.get(
        "monthly_pay",
        0
    )

    candidate = job.get(
        "application_candidate",
        {}
    )

    priority = candidate.get(
        "priority",
        "応募候補"
    )

    message = (
        "🚨 求人検索AI：最優先案件を発見\n\n"
        f"🏆 {title}\n\n"
        f"💰 月額: {monthly_pay:,}円\n"
        f"💵 報酬: {reward}\n"
        f"🤖 AIスコア: {ai_score}\n"
        f"⚙️ 自動化スコア: {automation_score}\n"
        f"📊 ランキング: {ranking_score}\n"
        f"🏠 リモート: {remote}\n"
        f"⭐ 優先度: {priority}\n\n"
        f"🔗 案件ページ\n{SOURCE_URL}\n\n"
        "📝 応募候補メッセージ\n"
        f"{candidate.get('application_message', '')}"
    )

    return message


# ============================================================
# Slack通知
# ============================================================

def send_slack_notification(job):

    if not SLACK_WEBHOOK_URL:

        print(
            "SLACK_WEBHOOK_URL が設定されていないため、"
            "Slack通知をスキップします。"
        )

        return False

    message = create_slack_message(
        job
    )

    payload = {
        "text": message
    }

    try:

        response = requests.post(
            SLACK_WEBHOOK_URL,
            json=payload,
            timeout=20
        )

        response.raise_for_status()

        print(
            "Slack通知成功"
        )

        return True

    except Exception as error:

        print(
            "Slack通知エラー:",
            error
        )

        return False


# ============================================================
# コンソール表示
# ============================================================

def print_jobs(jobs):

    print("")
    print("=" * 60)
    print("求人検索AI 完了")
    print("=" * 60)

    if not jobs:

        print(
            "条件を満たす案件がありませんでした。"
        )

        return

    for job in jobs:

        print(
            f"{job.get('rank')}位 "
            f"{job.get('title')}"
        )

        print(
            f"  月額: "
            f"{job.get('monthly_pay', 0):,}円"
        )

        print(
            f"  AI: "
            f"{job.get('score', 0)}"
        )

        print(
            f"  自動化: "
            f"{job.get('automation_score', 0)}"
        )

        print(
            f"  リモート: "
            f"{job.get('remote_score', 0)}"
        )

        print(
            f"  総合: "
            f"{job.get('ranking_score', 0)}"
        )

        print("")


# ============================================================
# メイン
# ============================================================

def main():

    print("")
    print("=" * 60)
    print("AI Job Search Agent")
    print("=" * 60)

    # 1. 案件取得
    page_text = fetch_jobs()

    if not page_text.strip():

        raise RuntimeError(
            "案件ページから情報を取得できませんでした。"
        )

    # 2. AI分析
    jobs = analyze_jobs(
        page_text
    )

    # 3. 条件フィルター
    jobs = filter_jobs(
        jobs
    )

    print(
        "条件通過件数:",
        len(jobs)
    )

    # 4. ランキング
    jobs = rank_jobs(
        jobs
    )

    # 5. jobs.json
    save_jobs(
        jobs
    )

    # 6. コンソール表示
    print_jobs(
        jobs
    )

    # 7. 1位案件をSlack通知
    if jobs:

        top_job = jobs[0]

        print(
            "最上位案件:",
            top_job.get(
                "title"
            )
        )

        send_slack_notification(
            top_job
        )

    else:

        print(
            "Slack通知対象の案件はありません。"
        )

    print("")
    print(
        "処理が正常終了しました。"
    )


# ============================================================
# 実行
# ============================================================

if __name__ == "__main__":
    main()