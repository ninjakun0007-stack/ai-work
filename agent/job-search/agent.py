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
MIN_AUTOMATION_SCORE = 70

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

    return soup.get_text("\n", strip=True)


# =========================
# JSON抽出
# =========================

def clean_json(text):

    text = text.strip()

    if text.startswith("```"):
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"^```\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    return json.loads(text)


# =========================
# AI案件分析
# =========================

def analyze_jobs(page_text):

    prompt = f"""
あなたは「AI仕事探しエージェント」です。

以下の求人情報から、Python / AI / Web開発系の案件を探してください。

重要な目的は、
「AIを最大限使って作業できる案件」
を優先して見つけることです。

【基本条件】

1. 月額報酬50万円以上
2. AI適合度80点以上
3. Python / AI / Web開発を優先
4. フルリモートを最優先
5. リモート可を次に優先
6. ハイブリッドをその次
7. 常駐は大きく減点
8. 同じ案件を重複させない

【AI自動化適性】

以下を0〜100点で評価してください。

・AIだけでコード作成しやすい
・AIだけで文章/資料作成しやすい
・AIによるテスト自動化が可能
・AIによるデバッグが可能
・APIを利用した自動化が可能
・定型作業が多い
・オンラインで完結できる
・人間による現地作業が少ない
・電話対応や対面対応が少ない
・資格/本人確認/現場作業への依存が少ない

逆に以下は減点してください。

・現地作業
・常駐必須
・対面接客
・電話中心
・物理機器の操作
・資格が必須
・本人による高度な判断が大量に必要
・機密情報をAIへ入力できない可能性が高い

【AI自動化適性の分類】

90〜100:
AI中心でかなり自動化しやすい

80〜89:
AIをかなり活用できる

70〜79:
AI活用可能だが人間作業も必要

60〜69:
AI活用は限定的

0〜59:
AIだけでは難しい

【リモートスコア】

フルリモート = 100
完全リモート = 100
リモート可 = 90
ハイブリッド = 70
リモート一部可 = 60
不明 = 40
常駐 = 20

【ランキング】

以下の重みで総合ランキングを作ってください。

AI自動化適性 35%
AI/Python/Web適合度 25%
リモート 25%
報酬 15%

報酬は月50万円を0点、
月110万円以上を100点として計算してください。

【重要】

実際にAIだけで対応できると断定しないでください。

案件情報から判断して、
「AIだけで対応しやすそうか」
を評価してください。

必ずJSONだけを返してください。

形式:

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

    "ranking_score": 0
  }}
]

案件情報:

{page_text[:50000]}
"""

    response = client.responses.create(
        model="gpt-5-mini",
        input=prompt
    )

    return clean_json(response.output_text)


# =========================
# 条件フィルター
# =========================

def filter_jobs(jobs):

    filtered = []

    for job in jobs:

        try:
            monthly_pay = int(job.get("monthly_pay", 0))
        except:
            monthly_pay = 0

        try:
            score = int(job.get("score", 0))
        except:
            score = 0

        try:
            automation_score = int(
                job.get("automation_score", 0)
            )
        except:
            automation_score = 0

        if monthly_pay < MIN_MONTHLY_PAY:
            continue

        if score < MIN_AI_SCORE:
            continue

        if automation_score < MIN_AUTOMATION_SCORE:
            continue

        job["monthly_pay"] = monthly_pay
        job["score"] = score
        job["automation_score"] = automation_score

        filtered.append(job)

    return filtered


# =========================
# リモートスコア
# =========================

def get_remote_score(remote):

    remote = str(remote)

    if "フルリモート" in remote:
        return 100

    if "完全リモート" in remote:
        return 100

    if "リモート可" in remote:
        return 90

    if "リモートワーク" in remote:
        return 90

    if "ハイブリッド" in remote:
        return 70

    if "一部リモート" in remote:
        return 60

    if "常駐" in remote:
        return 20

    return 40


# =========================
# 報酬スコア
# =========================

def get_pay_score(monthly_pay):

    score = (
        (monthly_pay - 500000)
        / 600000
        * 100
    )

    return max(0, min(100, score))


# =========================
# ランキング
# =========================

def rank_jobs(jobs):

    for job in jobs:

        remote_score = get_remote_score(
            job.get("remote", "")
        )

        pay_score = get_pay_score(
            job.get("monthly_pay", 0)
        )

        ai_score = job.get("score", 0)

        automation_score = job.get(
            "automation_score",
            0
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


# =========================
# jobs.json保存
# =========================

def save_jobs(jobs):

    output = {
        "source": SOURCE_URL,

        "search_conditions": {
            "keyword": "Python / AI / Web",
            "minimum_monthly_pay": MIN_MONTHLY_PAY,
            "minimum_ai_score": MIN_AI_SCORE,
            "minimum_automation_score":
                MIN_AUTOMATION_SCORE,
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
    print("")
    print(f"抽出件数: {len(jobs)}")
    print("")

    for job in jobs:

        print(
            f"{job['rank']}位 | "
            f"{job['title']}"
        )

        print(
            f"月額: "
            f"{job['monthly_pay']:,}円"
        )

        print(
            f"AI適合度: "
            f"{job['score']}"
        )

        print(
            f"AI自動化適性: "
            f"{job['automation_score']}"
        )

        print(
            f"リモート: "
            f"{job['remote_score']}"
        )

        print(
            f"総合: "
            f"{job['ranking_score']}"
        )

        print(
            f"判定: "
            f"{job['automation_level']}"
        )

        print("--------------------------------")

    print("")
    print("jobs.json を作成しました")


# =========================
# メイン
# =========================

def main():

    print("")
    print("================================")
    print("AI仕事探しエージェント")
    print("================================")
    print("")

    print("案件情報を取得しています...")

    page_text = fetch_jobs()

    print(
        f"取得文字数: {len(page_text)}"
    )

    print("")
    print("AIで案件を分析しています...")

    jobs = analyze_jobs(page_text)

    print(
        f"AI分析件数: {len(jobs)}"
    )

    print("")
    print("条件でフィルターしています...")

    jobs = filter_jobs(jobs)

    print(
        f"条件通過件数: {len(jobs)}"
    )

    print("")
    print("AI自動化適性＋リモート＋報酬で")
    print("ランキングしています...")

    jobs = rank_jobs(jobs)

    save_jobs(jobs)


# =========================
# 実行
# =========================

if __name__ == "__main__":
    main()