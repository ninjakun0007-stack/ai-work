import os
import json
import re
import requests
from bs4 import BeautifulSoup
from openai import OpenAI

# ==========================================
# 設定
# ==========================================

URL = "https://tech-agent.lancers.jp/project?q_text=Python"

MIN_MONTHLY_PAY = 500000

client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"]
)

headers = {
    "User-Agent": "Mozilla/5.0"
}


# ==========================================
# 求人ページを取得
# ==========================================

print("求人ページを取得しています...")

response = requests.get(
    URL,
    headers=headers,
    timeout=30
)

response.raise_for_status()

soup = BeautifulSoup(
    response.text,
    "html.parser"
)

page_text = soup.get_text(
    "\n",
    strip=True
)

print("求人ページ取得完了")


# ==========================================
# AIに案件を分析させる
# ==========================================

prompt = f"""
あなたは案件検索・選別AIです。

以下の公開案件情報から、
Python・AI・Web開発に関係する案件を抽出してください。

必ずJSON配列だけを返してください。
Markdownの```は使用しないでください。

各案件は以下の形式にしてください。

[
  {{
    "title": "案件名",
    "reward": "報酬",
    "description": "仕事内容",
    "remote": "リモート条件",
    "score": 0,
    "recommended": true,
    "reason": "おすすめ理由"
  }}
]

scoreは0〜100点。

評価基準：

1. Python / AI / Web開発との関連性
2. 報酬
3. リモート可能性
4. 仕事内容の明確さ
5. AIによる開発・自動化との相性

特に以下を高く評価してください。

・Python
・生成AI
・OpenAI API
・RAG
・機械学習
・FastAPI
・Django
・Web開発
・AWS
・Docker
・フルリモート
・週3日〜週5日

案件情報：

{page_text[:30000]}
"""

print("AIが案件を分析しています...")

response = client.responses.create(
    model="gpt-5-mini",
    input=prompt
)

ai_result = response.output_text.strip()

print("AI分析完了")


# ==========================================
# AI結果をJSONに変換
# ==========================================

try:
    jobs = json.loads(ai_result)

except json.JSONDecodeError:

    print("AI結果のJSON解析に失敗しました。")

    # Markdownの```が入っていた場合の対策
    cleaned = re.sub(
        r"```json|```",
        "",
        ai_result
    ).strip()

    try:
        jobs = json.loads(cleaned)

    except json.JSONDecodeError:
        print(ai_result)
        raise


if not isinstance(jobs, list):
    raise ValueError("AIの結果がJSON配列ではありません。")


print(f"AIが取得した案件数: {len(jobs)}")


# ==========================================
# 報酬を数値化
# ==========================================

def extract_monthly_pay(reward):

    if not reward:
        return 0

    reward = str(reward)

    # 例：
    # 1,100,000円
    # 〜700,000円/月
    # 月50万円〜70万円

    # 「万円」表記
    man_match = re.search(
        r"(\d+(?:\.\d+)?)\s*万\s*円",
        reward
    )

    if man_match:
        return int(
            float(man_match.group(1)) * 10000
        )

    # 「円」表記
    yen_match = re.search(
        r"(\d[\d,]*)\s*円",
        reward
    )

    if yen_match:
        return int(
            yen_match.group(1).replace(",", "")
        )

    return 0


# ==========================================
# リモート評価
# ==========================================

def remote_score(remote):

    if not remote:
        return 0

    remote = str(remote)

    if "フルリモート" in remote:
        return 20

    if "完全リモート" in remote:
        return 20

    if "リモートワーク" in remote:
        return 12

    if "リモート" in remote:
        return 10

    if "ハイブリッド" in remote:
        return 5

    if "常駐" in remote:
        return -15

    return 0


# ==========================================
# 週の稼働日数評価
# ==========================================

def work_days_score(job):

    text = (
        str(job.get("title", "")) +
        " " +
        str(job.get("description", ""))
    )

    if "週3日" in text:
        return 5

    if "週4日" in text:
        return 5

    if "週5日" in text:
        return 3

    return 0


# ==========================================
# Python / AI / Web評価
# ==========================================

def technology_score(job):

    text = (
        str(job.get("title", "")) +
        " " +
        str(job.get("description", ""))
    ).lower()

    score = 0

    keywords = {
        "python": 5,
        "生成ai": 8,
        "openai": 8,
        "gpt": 5,
        "rag": 8,
        "機械学習": 8,
        "ai": 5,
        "fastapi": 5,
        "django": 5,
        "web": 5,
        "aws": 3,
        "docker": 3
    }

    for keyword, point in keywords.items():

        if keyword in text:
            score += point

    return min(score, 20)


# ==========================================
# 80点以上の案件を選別
# ==========================================

qualified_jobs = []

for job in jobs:

    original_score = job.get("score", 0)

    if not isinstance(
        original_score,
        (int, float)
    ):
        original_score = 0

    monthly_pay = extract_monthly_pay(
        job.get("reward", "")
    )

    remote_bonus = remote_score(
        job.get("remote", "")
    )

    days_bonus = work_days_score(
        job
    )

    technology_bonus = technology_score(
        job
    )

    # AI評価を基本点として使用
    ranking_score = (
        original_score
        + remote_bonus
        + days_bonus
        + technology_bonus
    )

    # 月50万円未満は除外
    if monthly_pay < MIN_MONTHLY_PAY:
        continue

    # AI評価80点未満も除外
    if original_score < 80:
        continue

    job["monthly_pay"] = monthly_pay

    job["ranking_score"] = ranking_score

    job["recommended"] = True

    qualified_jobs.append(job)


# ==========================================
# ランキング
# ==========================================

qualified_jobs.sort(
    key=lambda job: job["ranking_score"],
    reverse=True
)


# ==========================================
# 順位を付ける
# ==========================================

for index, job in enumerate(
    qualified_jobs,
    start=1
):

    job["rank"] = index


# ==========================================
# jobs.jsonを作成
# ==========================================

data = {
    "source": URL,

    "search_conditions": {
        "keyword": "Python / AI / Web",
        "minimum_monthly_pay": MIN_MONTHLY_PAY,
        "remote_priority": True,
        "minimum_ai_score": 80
    },

    "count": len(qualified_jobs),

    "jobs": qualified_jobs
}


with open(
    "jobs.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        data,
        f,
        ensure_ascii=False,
        indent=2
    )


# ==========================================
# 結果表示
# ==========================================

print("")
print("==========================================")
print("AI案件ランキング")
print("==========================================")

if not qualified_jobs:

    print("条件に合う案件はありませんでした。")

else:

    for job in qualified_jobs:

        print(
            f"{job['rank']}位 "
            f"{job['title']}"
        )

        print(
            f"  AI評価: {job['score']}点"
        )

        print(
            f"  月額: {job['monthly_pay']:,}円"
        )

        print(
            f"  リモート: {job.get('remote', '不明')}"
        )

        print(
            f"  ランキング: {job['ranking_score']}点"
        )

        print("")


print("==========================================")
print(
    f"条件に合格した案件: {len(qualified_jobs)}件"
)
print("jobs.json を作成しました")
print("==========================================")