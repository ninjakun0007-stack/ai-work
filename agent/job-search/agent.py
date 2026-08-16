import os
import json
import re
import requests
from bs4 import BeautifulSoup
from openai import OpenAI

# =========================
# 設定
# =========================

SOURCE_URL = "https://tech-agent.lancers.jp/project?q_text=Python"

MIN_MONTHLY_PAY = 500000
MIN_AI_SCORE = 80

# AI API
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# =========================
# 案件ページ取得
# =========================

def fetch_jobs():
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

    soup = BeautifulSoup(response.text, "html.parser")

    text = soup.get_text("\n", strip=True)

    return text


# =========================
# AIで案件を解析
# =========================

def analyze_jobs(page_text):

    prompt = f"""
あなたは求人・案件選別AIです。

以下の案件情報から、
Python / AI / Web開発に関係する案件を抽出してください。

条件：

1. 月額報酬50万円以上
2. AI・Python・Web開発との関連性を重視
3. フルリモートを最優先
4. リモート可を次に優先
5. 常駐は順位を下げる
6. AI適合度80点未満は除外
7. 報酬が高いほど評価
8. Python / OpenAI / Gemini / RAG / LangChain /
   LlamaIndex / PyTorch / TensorFlow / AWS等を評価
9. 同じ案件は重複させない

スコアは0〜100。

さらにランキングスコアを計算してください。

ランキングの考え方：

AI適合度       40%
リモート       30%
報酬           20%
Python/Web     10%

フルリモートはリモート点100、
リモート可は80、
ハイブリッドは70、
不明は50、
常駐は20程度を目安にしてください。

必ずJSONだけを返してください。

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
    "ranking_score": 0
  }}
]

案件情報：
{page_text[:50000]}
"""

    response = client.responses.create(
        model="gpt-5-mini",
        input=prompt
    )

    result = response.output_text

    # ```json ... ``` が返ってきた場合に対応
    result = result.strip()

    if result.startswith("```"):
        result = re.sub(r"^```json\s*", "", result)
        result = re.sub(r"\s*```$", "", result)

    return json.loads(result)


# =========================
# 条件フィルター
# =========================

def filter_jobs(jobs):

    filtered = []

    for job in jobs:

        monthly_pay = job.get("monthly_pay", 0)
        score = job.get("score", 0)

        try:
            monthly_pay = int(monthly_pay)
        except:
            monthly_pay = 0

        try:
            score = int(score)
        except:
            score = 0

        # 月50万円未満を除外
        if monthly_pay < MIN_MONTHLY_PAY:
            continue

        # AIスコア80未満を除外
        if score < MIN_AI_SCORE:
            continue

        job["monthly_pay"] = monthly_pay
        job["score"] = score

        filtered.append(job)

    return filtered


# =========================
# リモート優先ランキング
# =========================

def rank_jobs(jobs):

    for job in jobs:

        remote = str(job.get("remote", "")).lower()

        # リモート評価
        if "フルリモート" in remote:
            remote_score = 100

        elif "完全リモート" in remote:
            remote_score = 100

        elif "リモートワーク" in remote:
            remote_score = 80

        elif "リモート可" in remote:
            remote_score = 80

        elif "ハイブリッド" in remote:
            remote_score = 70

        elif "リモート" in remote:
            remote_score = 70

        elif "常駐" in remote:
            remote_score = 20

        else:
            remote_score = 40

        job["remote_score"] = remote_score

        # 報酬スコア
        pay = job.get("monthly_pay", 0)

        # 50万円〜110万円程度を0〜100に変換
        pay_score = min(
            100,
            max(
                0,
                ((pay - 500000) / 600000) * 100
            )
        )

        # Python / AI / Web適合度
        ai_score = job.get("score", 0)

        # 総合ランキング
        ranking_score = (
            ai_score * 0.40
            + remote_score * 0.30
            + pay_score * 0.20
            + 80 * 0.10
        )

        job["ranking_score"] = round(ranking_score, 1)

    # 高い順
    jobs.sort(
        key=lambda x: x.get("ranking_score", 0),
        reverse=True
    )

    # 順位を付ける
    for index, job in enumerate(jobs, start=1):
        job["rank"] = index

    return jobs


# =========================
# jobs.json 保存
# =========================

def save_jobs(jobs):

    output = {
        "source": SOURCE_URL,
        "search_conditions": {
            "keyword": "Python / AI / Web",
            "minimum_monthly_pay": MIN_MONTHLY_PAY,
            "remote_priority": True,
            "minimum_ai_score": MIN_AI_SCORE
        },
        "count": len(jobs),
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

    print("================================")
    print("求人検索AI 完了")
    print("================================")

    print(f"抽出件数: {len(jobs)}")

    for job in jobs:
        print(
            f"{job['rank']}位 "
            f"{job['title']} "
            f"月{job['monthly_pay']:,}円 "
            f"AIスコア:{job['score']} "
            f"ランキング:{job['ranking_score']}"
        )

    print("jobs.json を作成しました")


# =========================
# メイン処理
# =========================

def main():

    print("案件情報を取得しています...")

    page_text = fetch_jobs()

    print("AIで案件を分析しています...")

    jobs = analyze_jobs(page_text)

    print(f"AI抽出件数: {len(jobs)}")

    jobs = filter_jobs(jobs)

    print(
        f"条件通過件数: {len(jobs)}"
    )

    jobs = rank_jobs(jobs)

    save_jobs(jobs)


if __name__ == "__main__":
    main()