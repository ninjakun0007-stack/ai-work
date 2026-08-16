import os
import json
import re
import requests
from bs4 import BeautifulSoup
from openai import OpenAI


# =========================================================
# 設定
# =========================================================

SOURCE_URL = "https://tech-agent.lancers.jp/project?q_text=Python"

MIN_MONTHLY_PAY = 500000
MIN_AI_SCORE = 80
MIN_AUTOMATION_SCORE = 70

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY が設定されていません")

client = OpenAI(api_key=OPENAI_API_KEY)


# =========================================================
# 求人ページ取得
# =========================================================

def fetch_jobs():

    print("案件ページを取得しています...")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
            "AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
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

    print(f"取得文字数: {len(text)}")

    return text


# =========================================================
# AIで求人を分析
# =========================================================

def analyze_jobs(page_text):

    print("AIで案件を分析しています...")

    prompt = """
あなたは「AIを最大限活用して仕事を進めたい人」のための求人選別AIです。

以下の求人情報から、
Python / AI / Web開発に関係する案件を抽出してください。

【必須条件】

1. 月額報酬50万円以上
2. AIスコア80以上
3. 自動化スコア70以上
4. Python / AI / Webとの関連性が高い
5. リモートを優先
6. フルリモートを最優先
7. 常駐案件は順位を下げる
8. AIを使って作業を進めやすい案件を優先
9. 電話対応・対面営業・現地作業が多い案件は順位を下げる
10. 同じ案件は重複させない

【AI評価】

0〜100点で評価してください。

以下を特に評価してください。

OpenAI
GPT
Gemini
RAG
LangChain
LlamaIndex
Hugging Face
PyTorch
TensorFlow
Python
FastAPI
Django
AWS
API連携
AI自動化
Web開発
データ処理
テスト自動化

【自動化スコア】

以下を総合して0〜100点で評価してください。

- AIでコード作成しやすい
- AIで文章・資料作成しやすい
- AIでテスト自動化できる
- AIでデバッグできる
- APIによる自動化が可能
- 定型作業が多い
- オンライン完結しやすい
- 現地作業が少ない
- 電話・対面対応が少ない
- 資格・本人確認・現場作業への依存が少ない

【リモート評価】

フルリモート = 100
完全リモート = 100
リモート可 = 90
リモートワーク = 90
ハイブリッド = 80
一部リモート = 70
不明 = 40
常駐 = 20

【ランキング】

以下の割合で評価してください。

自動化適合度 35%
AI適合度      25%
リモート      25%
報酬          15%

【応募候補】

以下の条件を満たす案件は応募候補にしてください。

- 月額50万円以上
- AIスコア80以上
- 自動化スコア70以上
- AI中心で作業しやすい
- リモートまたはオンラインで進めやすい

応募候補には以下を作ってください。

recommended
priority
reason
application_message
questions

応募メッセージは、
実際の応募前に人間が確認できる下書きとして作成してください。

勝手に応募したり、応募を送信したりしないでください。

また、
「AIだけで完全に仕事ができる」と断定しないでください。

人間による確認、設計、顧客との連絡、契約、
品質確認などが必要になる可能性も考慮してください。

【重要】

必ずJSONだけを返してください。

Markdownは禁止です。
コードブロックは禁止です。

JSON形式：

{
  "jobs": [
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
      "ranking_score": 0,
      "application_candidate": {
        "recommended": true,
        "priority": "",
        "reason": "",
        "application_message": "",
        "questions": []
      }
    }
  ]
}

求人情報：
""" + page_text[:50000]

    response = client.responses.create(
        model="gpt-5-mini",
        input=prompt
    )

    result = response.output_text.strip()

    # Markdownコードブロックが返った場合
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

    try:
        data = json.loads(result)
    except json.JSONDecodeError as e:

        print("AIのJSON解析に失敗しました。")
        print(result[:3000])

        raise RuntimeError(
            f"AIが正しいJSONを返しませんでした: {e}"
        )

    return data


# =========================================================
# 条件フィルター
# =========================================================

def filter_jobs(jobs):

    filtered = []

    for job in jobs:

        try:
            monthly_pay = int(
                job.get("monthly_pay", 0)
            )
        except Exception:
            monthly_pay = 0

        try:
            ai_score = int(
                job.get("score", 0)
            )
        except Exception:
            ai_score = 0

        try:
            automation_score = int(
                job.get("automation_score", 0)
            )
        except Exception:
            automation_score = 0

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

        filtered.append(job)

    return filtered


# =========================================================
# リモートスコア
# =========================================================

def calculate_remote_score(remote):

    text = str(remote).lower()

    if "フルリモート" in text:
        return 100

    if "完全リモート" in text:
        return 100

    if "リモート可" in text:
        return 90

    if "リモートワーク" in text:
        return 90

    if "ハイブリッド" in text:
        return 80

    if "一部リモート" in text:
        return 70

    if "常駐" in text:
        return 20

    if "フル出社" in text:
        return 20

    return 40


# =========================================================
# ランキング
# =========================================================

def rank_jobs(jobs):

    for job in jobs:

        remote_score = calculate_remote_score(
            job.get("remote", "")
        )

        job["remote_score"] = remote_score

        # 報酬スコア
        pay = job.get(
            "monthly_pay",
            0
        )

        # 50万円〜110万円を0〜100点
        pay_score = min(
            100,
            max(
                0,
                ((pay - 500000) / 600000) * 100
            )
        )

        ai_score = job.get(
            "score",
            0
        )

        automation_score = job.get(
            "automation_score",
            0
        )

        # 自動化35%
        # AI25%
        # リモート25%
        # 報酬15%

        ranking_score = (
            automation_score * 0.35
            + ai_score * 0.25
            + remote_score * 0.25
            + pay_score * 0.15
        )

        job["pay_score"] = round(
            pay_score,
            1
        )

        job["ranking_score"] = round(
            ranking_score,
            1
        )

    # 高い順
    jobs.sort(
        key=lambda x: x.get(
            "ranking_score",
            0
        ),
        reverse=True
    )

    # 順位
    for index, job in enumerate(
        jobs,
        start=1
    ):
        job["rank"] = index

    return jobs


# =========================================================
# 応募候補
# =========================================================

def create_application_candidates(jobs):

    candidates = []

    for job in jobs:

        application = job.get(
            "application_candidate",
            {}
        )

        if application.get(
            "recommended",
            False
        ):
            candidates.append(job)

    return candidates


# =========================================================
# jobs.json保存
# =========================================================

def save_jobs(jobs):

    candidates = create_application_candidates(
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

        "application_candidate_count": len(
            candidates
        ),

        "jobs": jobs
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

    print("")
    print("================================")
    print("求人検索AI 完了")
    print("================================")

    print(
        f"抽出件数: {len(jobs)}"
    )

    print(
        f"応募候補: {len(candidates)}"
    )

    print("")

    for job in jobs:

        print(
            f"{job.get('rank', '-') }位 "
            f"{job.get('title', '不明')} "
            f"月{job.get('monthly_pay', 0):,}円 "
            f"AI:{job.get('score', 0)} "
            f"自動化:{job.get('automation_score', 0)} "
            f"リモート:{job.get('remote_score', 0)} "
            f"総合:{job.get('ranking_score', 0)}"
        )

    print("")
    print("jobs.json を作成しました")


# =========================================================
# Slack通知
# =========================================================

def send_slack_notification(jobs):

    if not SLACK_WEBHOOK_URL:

        print("")
        print(
            "SLACK_WEBHOOK_URL が設定されていません。"
        )
        print(
            "Slack通知をスキップします。"
        )

        return

    if not jobs:

        print("")
        print(
            "条件を満たす案件がありません。"
        )
        print(
            "Slack通知はありません。"
        )

        return

    # 1位案件
    top_job = jobs[0]

    title = top_job.get(
        "title",
        "案件名不明"
    )

    reward = top_job.get(
        "reward",
        "不明"
    )

    remote = top_job.get(
        "remote",
        "不明"
    )

    ai_score = top_job.get(
        "score",
        0
    )

    automation_score = top_job.get(
        "automation_score",
        0
    )

    ranking_score = top_job.get(
        "ranking_score",
        0
    )

    application = top_job.get(
        "application_candidate",
        {}
    )

    priority = application.get(
        "priority",
        "応募候補"
    )

    reason = application.get(
        "reason",
        top_job.get(
            "reason",
            "AIによる選定"
        )
    )

    message = (
        "🚀 AI求人検索AI\n"
        "\n"
        "🏆 最優先案件を発見しました\n"
        "\n"
        f"【1位】{title}\n"
        "\n"
        f"💰 報酬：{reward}\n"
        f"🏠 リモート：{remote}\n"
        f"🤖 AIスコア：{ai_score}/100\n"
        f"⚙️ 自動化：{automation_score}/100\n"
        f"📊 総合ランキング：{ranking_score}\n"
        f"⭐ 優先度：{priority}\n"
        "\n"
        "【選定理由】\n"
        f"{reason}\n"
        "\n"
        f"🔗 {SOURCE_URL}\n"
        "\n"
        "※応募前に仕事内容・契約条件・"
        "報酬・リモート条件を確認してください。"
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

        print("")
        print(
            "✅ Slack通知を送信しました。"
        )

    except Exception as e:

        # Slackエラーだけでは求人検索を失敗させない
        print("")
        print(
            f"⚠️ Slack通知に失敗しました: {e}"
        )


# =========================================================
# メイン
# =========================================================

def main():

    print("")
    print("================================")
    print("AI求人検索を開始")
    print("================================")

    # 1. 求人ページ取得
    page_text = fetch_jobs()

    # 2. AI分析
    result = analyze_jobs(
        page_text
    )

    jobs = result.get(
        "jobs",
        []
    )

    print(
        f"AI抽出件数: {len(jobs)}"
    )

    # 3. 条件フィルター
    jobs = filter_jobs(
        jobs
    )

    print(
        f"条件通過件数: {len(jobs)}"
    )

    # 4. ランキング
    jobs = rank_jobs(
        jobs
    )

    # 5. jobs.json保存
    save_jobs(
        jobs
    )

    # 6. Slack通知
    send_slack_notification(
        jobs
    )

    print("")
    print("================================")
    print("すべての処理が完了しました")
    print("================================")


# =========================================================
# 実行
# =========================================================

if __name__ == "__main__":
    main()