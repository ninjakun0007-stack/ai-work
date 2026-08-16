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

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")

client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"]
)


# ============================================================
# 案件ページ取得
# ============================================================

def fetch_jobs():

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
            "AppleWebKit/605.1.15 "
            "Mobile/15E148 Safari/604.1"
        )
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

    text = soup.get_text(
        "\n",
        strip=True
    )

    return text


# ============================================================
# AI案件分析
# ============================================================

def analyze_jobs(page_text):

    prompt = f"""
あなたはAI求人選別エージェントです。

以下の求人情報から、
Python / AI / Web開発案件を抽出してください。

ユーザーの希望：

・AIを最大限活用して仕事をしたい
・AIだけで進めやすい案件を優先
・Python / AI / Web開発
・月額50万円以上
・フルリモートを最優先
・リモート可を次に優先
・常駐は順位を下げる
・AI適合度80点未満は除外
・自動化スコア70点未満は除外

評価してください。

AIスコア
0〜100

自動化スコア
0〜100

リモートスコア
0〜100

AIだけで仕事を進められる度合い
0〜100

以下を特に評価：

・OpenAI
・GPT
・Gemini
・Claude
・RAG
・LangChain
・LlamaIndex
・Hugging Face
・PyTorch
・TensorFlow
・Python
・FastAPI
・Django
・AWS
・API連携
・自動化
・コード生成
・テスト自動化
・デバッグ
・ドキュメント生成
・オンライン完結

リモートスコアの目安：

フルリモート = 100
完全リモート = 100
リモート可 = 90
ハイブリッド = 80
リモートあり = 80
不明 = 40
常駐 = 20

自動化スコアの目安：

90〜100 = AI中心でかなり自動化可能
80〜89 = AIをかなり活用可能
70〜79 = AIを一部活用可能
69以下 = 除外

AIだけで仕事をしたいという目的を最優先してください。

ランキングウェイト：

automation = 35%
ai = 25%
remote = 25%
reward = 15%

ranking_scoreを計算してください。

さらに、応募候補になる案件については
応募候補情報も作ってください。

応募候補には：

・recommended
・priority
・reason
・application_message
・questions

を含めてください。

application_messageは
そのまま企業に送れる自然な日本語にしてください。

ただし、
「AIだけで全部仕事をします」
のような不自然な表現は使わないでください。

必ずJSONだけ返してください。

形式：

[
  {{
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

    "ai_automation_breakdown": {{
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
    }},

    "ranking_score": 0,

    "application_candidate": {{
      "recommended": true,
      "priority": "",
      "reason": "",
      "application_message": "",
      "questions": []
    }}
  }}
]

求人情報：

{page_text[:50000]}
"""

    response = client.responses.create(
        model="gpt-5-mini",
        input=prompt
    )

    result = response.output_text.strip()

    # Markdownコードブロック除去
    if result.startswith("```"):
        result = re.sub(
            r"^```(?:json)?\s*",
            "",
            result
        )

        result = re.sub(
            r"\s*```$",
            "",
            result
        )

    return json.loads(result)


# ============================================================
# 数値変換
# ============================================================

def to_int(value, default=0):

    try:

        if isinstance(value, int):
            return value

        if isinstance(value, float):
            return int(value)

        value = str(value)

        value = (
            value
            .replace(",", "")
            .replace("円", "")
            .replace("万円", "")
        )

        numbers = re.findall(
            r"\d+",
            value
        )

        if not numbers:
            return default

        return int(
            "".join(numbers)
        )

    except Exception:

        return default


# ============================================================
# 月額報酬推定
# ============================================================

def normalize_monthly_pay(job):

    pay = to_int(
        job.get("monthly_pay", 0)
    )

    if pay > 0:
        return pay

    reward = str(
        job.get("reward", "")
    )

    # 110万円
    match = re.search(
        r"(\d+(?:\.\d+)?)\s*万円",
        reward
    )

    if match:

        return int(
            float(match.group(1)) * 10000
        )

    # 1,100,000円
    match = re.search(
        r"([\d,]+)\s*円",
        reward
    )

    if match:

        return int(
            match.group(1).replace(",", "")
        )

    return 0


# ============================================================
# 条件フィルター
# ============================================================

def filter_jobs(jobs):

    filtered = []

    seen_titles = set()

    for job in jobs:

        title = str(
            job.get("title", "")
        ).strip()

        if not title:
            continue

        # 重複除去
        normalized_title = re.sub(
            r"\s+",
            "",
            title
        )

        if normalized_title in seen_titles:
            continue

        seen_titles.add(
            normalized_title
        )

        monthly_pay = normalize_monthly_pay(
            job
        )

        ai_score = to_int(
            job.get("score", 0)
        )

        automation_score = to_int(
            job.get("automation_score", 0)
        )

        # 月50万円未満
        if monthly_pay < MIN_MONTHLY_PAY:
            continue

        # AIスコア80未満
        if ai_score < MIN_AI_SCORE:
            continue

        # 自動化スコア70未満
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
# リモートスコア
# ============================================================

def calculate_remote_score(remote):

    remote = str(
        remote or ""
    ).lower()

    if (
        "フルリモート" in remote
        or "完全リモート" in remote
    ):
        return 100

    if "リモート可" in remote:
        return 90

    if (
        "ハイブリッド" in remote
        or "リモートワーク" in remote
    ):
        return 80

    if "リモート" in remote:
        return 80

    if "常駐" in remote:
        return 20

    return 40


# ============================================================
# ランキング
# ============================================================

def rank_jobs(jobs):

    for job in jobs:

        remote_score = calculate_remote_score(
            job.get("remote", "")
        )

        job["remote_score"] = remote_score

        pay = job.get(
            "monthly_pay",
            0
        )

        # 50万円 = 0点
        # 110万円以上 = 100点
        pay_score = (
            (pay - 500000)
            / 600000
        ) * 100

        pay_score = max(
            0,
            min(
                100,
                pay_score
            )
        )

        job["pay_score"] = round(
            pay_score,
            1
        )

        ai_score = to_int(
            job.get("score", 0)
        )

        automation_score = to_int(
            job.get("automation_score", 0)
        )

        # AI 25%
        # 自動化 35%
        # リモート 25%
        # 報酬 15%

        ranking_score = (
            automation_score * 0.35
            + ai_score * 0.25
            + remote_score * 0.25
            + pay_score * 0.15
        )

        job["ranking_score"] = round(
            ranking_score,
            1
        )

    jobs.sort(
        key=lambda x: x.get(
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
# 応募候補作成
# ============================================================

def create_application_candidates(jobs):

    candidate_count = 0

    for job in jobs:

        score = to_int(
            job.get("score", 0)
        )

        automation = to_int(
            job.get(
                "automation_score",
                0
            )
        )

        ranking = float(
            job.get(
                "ranking_score",
                0
            )
        )

        remote_score = to_int(
            job.get(
                "remote_score",
                0
            )
        )

        # 応募候補条件
        recommended = (
            score >= 80
            and automation >= 70
            and ranking >= 65
        )

        if recommended:

            candidate_count += 1

            if ranking >= 85:
                priority = "最優先"

            elif ranking >= 75:
                priority = "高"

            else:
                priority = "通常"

            existing = job.get(
                "application_candidate",
                {}
            )

            # AIが作った内容を尊重
            if not existing:
                existing = {
                    "recommended": True,
                    "priority": priority,
                    "reason": (
                        "AI適合度、自動化適性、"
                        "リモート環境、報酬を総合評価した結果、"
                        "応募候補として適しています。"
                    ),
                    "application_message": (
                        "本案件に大変興味があります。"
                        "AIを活用した開発・自動化の経験を活かし、"
                        "プロジェクトに貢献したいと考えております。"
                        "技術スタック、担当範囲、"
                        "リモートでの稼働条件について"
                        "詳しく伺えますと幸いです。"
                    ),
                    "questions": [
                        "リモートでの稼働割合を教えてください。",
                        "主要な技術スタックを教えてください。",
                        "AIツールの利用に関するルールを教えてください。",
                        "担当する具体的な業務範囲を教えてください。",
                        "成果物と評価基準を教えてください。"
                    ]
                }

            existing["recommended"] = True
            existing["priority"] = priority

            job["application_candidate"] = existing

            job["ai_only_work_priority"] = True

        else:

            job["application_candidate"] = {
                "recommended": False,
                "priority": "対象外",
                "reason": (
                    "AI適合度、自動化適性、"
                    "ランキング条件を満たしていません。"
                ),
                "application_message": "",
                "questions": []
            }

            job["ai_only_work_priority"] = False

    return jobs, candidate_count


# ============================================================
# 前回1位読み込み
# ============================================================

def load_previous_top_job():

    try:

        with open(
            "jobs.json",
            "r",
            encoding="utf-8"
        ) as f:

            previous = json.load(f)

        jobs = previous.get(
            "jobs",
            []
        )

        if jobs:

            return jobs[0].get(
                "title",
                ""
            )

    except Exception:
        pass

    return ""


# ============================================================
# Slack通知
# ============================================================

def notify_slack(jobs, previous_top_title):

    if not SLACK_WEBHOOK_URL:

        print(
            "SLACK_WEBHOOK_URLが設定されていません。"
        )

        return

    if not jobs:

        print(
            "条件に合う案件がないためSlack通知なし"
        )

        return

    top_job = jobs[0]

    current_title = top_job.get(
        "title",
        ""
    )

    # 前回と同じ1位なら通知しない
    if (
        previous_top_title
        and current_title == previous_top_title
    ):

        print(
            "前回と同じ1位のためSlack通知なし"
        )

        return

    application = top_job.get(
        "application_candidate",
        {}
    )

    questions = application.get(
        "questions",
        []
    )

    question_text = ""

    for question in questions:

        question_text += (
            f"• {question}\n"
        )

    message = f"""
🚨 *AI求人 新しい1位案件*

🥇 *{current_title}*

💰 月額報酬：{top_job.get("monthly_pay", 0):,}円

🤖 AIスコア：
{top_job.get("score", 0)}

⚙️ 自動化スコア：
{top_job.get("automation_score", 0)}

🏠 リモートスコア：
{top_job.get("remote_score", 0)}

⭐ 総合ランキング：
{top_job.get("ranking_score", 0)}

🎯 AIだけで仕事を進められる適合度：
{top_job.get("ai_only_work_fit", 0)}

🔥 応募優先度：
{application.get("priority", "対象外")}

📝 AI評価：
{top_job.get("reason", "")}

📨 応募候補理由：
{application.get("reason", "")}

💬 応募文：
{application.get("application_message", "")}

❓ 確認事項：
{question_text}

🔗 案件検索：
{SOURCE_URL}
"""

    response = requests.post(
        SLACK_WEBHOOK_URL,
        json={
            "text": message
        },
        timeout=30
    )

    response.raise_for_status()

    print(
        "Slack通知成功"
    )


# ============================================================
# jobs.json保存
# ============================================================

def save_jobs(
    jobs,
    application_candidate_count
):

    output = {

        "source": SOURCE_URL,

        "search_conditions": {

            "keyword":
                "Python / AI / Web",

            "minimum_monthly_pay":
                MIN_MONTHLY_PAY,

            "minimum_ai_score":
                MIN_AI_SCORE,

            "minimum_automation_score":
                MIN_AUTOMATION_SCORE,

            "remote_priority":
                True,

            "ai_only_work_priority":
                True
        },

        "ranking_weights": {

            "automation":
                0.35,

            "ai":
                0.25,

            "remote":
                0.25,

            "reward":
                0.15
        },

        "count":
            len(jobs),

        "application_candidate_count":
            application_candidate_count,

        "jobs":
            jobs
    }

    with open(
        "jobs.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            output,
            f,
            ensure_ascii=False,
            indent=2
        )

    print(
        "================================"
    )

    print(
        "求人検索AI 完了"
    )

    print(
        "================================"
    )

    print(
        f"抽出件数: {len(jobs)}"
    )

    print(
        f"応募候補: "
        f"{application_candidate_count}"
    )

    for job in jobs:

        print(
            f"{job.get('rank', '-') }位 "
            f"{job.get('title', '')} "
            f"月{job.get('monthly_pay', 0):,}円 "
            f"AI:{job.get('score', 0)} "
            f"自動化:{job.get('automation_score', 0)} "
            f"リモート:{job.get('remote_score', 0)} "
            f"総合:{job.get('ranking_score', 0)}"
        )

    print(
        "jobs.json を作成しました"
    )


# ============================================================
# メイン
# ============================================================

def main():

    print(
        "================================"
    )

    print(
        "AI求人自動検索を開始"
    )

    print(
        "================================"
    )

    # 前回1位を取得
    previous_top_title = (
        load_previous_top_job()
    )

    print(
        "案件情報を取得しています..."
    )

    page_text = fetch_jobs()

    print(
        f"取得文字数: {len(page_text)}"
    )

    print(
        "AIで案件を分析しています..."
    )

    jobs = analyze_jobs(
        page_text
    )

    print(
        f"AI抽出件数: {len(jobs)}"
    )

    print(
        "条件フィルターを実行..."
    )

    jobs = filter_jobs(
        jobs
    )

    print(
        f"条件通過件数: {len(jobs)}"
    )

    print(
        "リモート優先ランキングを計算..."
    )

    jobs = rank_jobs(
        jobs
    )

    print(
        "応募候補を作成..."
    )

    (
        jobs,
        application_candidate_count
    ) = create_application_candidates(
        jobs
    )

    # 保存
    save_jobs(
        jobs,
        application_candidate_count
    )

    # Slack通知
    print(
        "Slack通知を確認..."
    )

    notify_slack(
        jobs,
        previous_top_title
    )

    print(
        "================================"
    )

    print(
        "すべての処理が完了しました"
    )

    print(
        "================================"
    )


# ============================================================
# 実行
# ============================================================

if __name__ == "__main__":
    main()