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

# 応募候補を作成する最低ランキング
MIN_APPLICATION_RANKING_SCORE = 60

OUTPUT_FILE = "jobs.json"

client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"]
)


# ============================================================
# 案件ページ取得
# ============================================================

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

    print(
        f"ページ取得完了: {len(text)}文字"
    )

    return text


# ============================================================
# JSON抽出
# ============================================================

def clean_json_text(text):

    text = text.strip()

    # ```json ... ``` 対策
    if text.startswith("```"):

        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text
        )

        text = re.sub(
            r"\s*```$",
            "",
            text
        )

    # JSON開始位置を探す
    first_array = text.find("[")

    first_object = text.find("{")

    positions = [
        p for p in [
            first_array,
            first_object
        ]
        if p >= 0
    ]

    if positions:

        start = min(positions)

        text = text[start:]

    return text.strip()


# ============================================================
# AI案件分析
# ============================================================

def analyze_jobs(page_text):

    print("AIで案件を分析しています...")

    prompt = f"""
あなたは「AIだけで仕事を進めたい人」のための
求人・フリーランス案件選別AIです。

以下の案件情報から、
Python / AI / Web開発に関係する案件を抽出してください。

重要な目的：

「人間の作業をできるだけ減らし、
AIを最大限使って仕事を進められる案件」
を最優先してください。

==================================================
基本条件
==================================================

1. 月額報酬50万円以上
2. AIスコア80点以上
3. 自動化スコア70点以上
4. Python / AI / Web開発との関連性を重視
5. フルリモートを最優先
6. リモート可を次に優先
7. ハイブリッドはその次
8. 常駐は順位を下げる
9. AIを利用した開発が可能な案件を高評価
10. 同じ案件は重複させない

==================================================
AI自動化適性
==================================================

以下をそれぞれ0〜100で評価してください。

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

==================================================
AIスコア
==================================================

Python
OpenAI
GPT
Gemini
RAG
LangChain
LlamaIndex
Hugging Face
PyTorch
TensorFlow
AWS
Docker
API
Web
などを評価してください。

==================================================
リモートスコア
==================================================

フルリモート = 100
完全リモート = 100
リモート可 = 90
リモートワーク = 90
ハイブリッド = 80
リモート相談可 = 70
不明 = 40
常駐 = 20

==================================================
ランキング
==================================================

ランキングスコアは以下で計算してください。

自動化適性 35%
AI適合度   25%
リモート   25%
報酬       15%

==================================================
応募候補
==================================================

条件を満たす案件について、

「応募候補としておすすめか」

も判定してください。

さらに応募候補について、

・応募優先度
・応募理由
・応募文
・企業への確認質問
・AIだけで仕事を進められそうな度合い

を作成してください。

応募文は、
実際の経歴や資格などを勝手に作らないでください。

「Python経験○年」
「実績○件」
「資格○○」
など、入力情報に存在しない情報は書かないでください。

==================================================
JSON形式
==================================================

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

案件情報：

{page_text[:50000]}
"""

    response = client.responses.create(
        model="gpt-5-mini",
        input=prompt
    )

    result = clean_json_text(
        response.output_text
    )

    try:

        jobs = json.loads(result)

    except json.JSONDecodeError as e:

        print("AIのJSON解析に失敗しました")

        print(result[:3000])

        raise e

    if not isinstance(jobs, list):

        raise ValueError(
            "AIの返却データが配列ではありません"
        )

    print(
        f"AI抽出件数: {len(jobs)}"
    )

    return jobs


# ============================================================
# 数値変換
# ============================================================

def to_number(value):

    if isinstance(value, (int, float)):

        return value

    if value is None:

        return 0

    text = str(value)

    text = text.replace(
        ",",
        ""
    )

    numbers = re.findall(
        r"\d+(?:\.\d+)?",
        text
    )

    if not numbers:

        return 0

    try:

        return float(numbers[0])

    except:

        return 0


# ============================================================
# 条件フィルター
# ============================================================

def filter_jobs(jobs):

    filtered = []

    for job in jobs:

        monthly_pay = int(
            to_number(
                job.get(
                    "monthly_pay",
                    0
                )
            )
        )

        score = int(
            to_number(
                job.get(
                    "score",
                    0
                )
            )
        )

        automation_score = int(
            to_number(
                job.get(
                    "automation_score",
                    0
                )
            )
        )

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


# ============================================================
# 重複削除
# ============================================================

def remove_duplicates(jobs):

    unique = {}

    for job in jobs:

        title = str(
            job.get(
                "title",
                ""
            )
        ).strip()

        if not title:

            continue

        if title not in unique:

            unique[title] = job

    return list(
        unique.values()
    )


# ============================================================
# リモートスコア
# ============================================================

def calculate_remote_score(remote):

    remote = str(
        remote or ""
    ).lower()

    if "フルリモート" in remote:
        return 100

    if "完全リモート" in remote:
        return 100

    if "リモート可" in remote:
        return 90

    if "リモートワーク" in remote:
        return 90

    if "ハイブリッド" in remote:
        return 80

    if "リモート相談" in remote:
        return 70

    if "常駐" in remote:
        return 20

    return 40


# ============================================================
# 報酬スコア
# ============================================================

def calculate_pay_score(monthly_pay):

    monthly_pay = int(
        to_number(
            monthly_pay
        )
    )

    # 50万円 = 0
    # 110万円以上 = 100

    score = (
        (monthly_pay - 500000)
        / 600000
        * 100
    )

    score = max(
        0,
        min(
            100,
            score
        )
    )

    return round(
        score,
        1
    )


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

        job["remote_score"] = remote_score

        pay_score = calculate_pay_score(
            job.get(
                "monthly_pay",
                0
            )
        )

        job["pay_score"] = pay_score

        ai_score = int(
            to_number(
                job.get(
                    "score",
                    0
                )
            )
        )

        automation_score = int(
            to_number(
                job.get(
                    "automation_score",
                    0
                )
            )
        )

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
# 応募候補の最終判定
# ============================================================

def prepare_application_candidates(jobs):

    for job in jobs:

        ranking_score = float(
            to_number(
                job.get(
                    "ranking_score",
                    0
                )
            )
        )

        automation_score = int(
            to_number(
                job.get(
                    "automation_score",
                    0
                )
            )
        )

        ai_score = int(
            to_number(
                job.get(
                    "score",
                    0
                )
            )
        )

        remote_score = int(
            to_number(
                job.get(
                    "remote_score",
                    0
                )
            )
        )

        # 応募候補条件
        candidate = (
            ranking_score
            >= MIN_APPLICATION_RANKING_SCORE
            and automation_score >= 70
            and ai_score >= 80
        )

        if candidate:

            if ranking_score >= 80:

                priority = "最優先"

            elif ranking_score >= 70:

                priority = "高"

            else:

                priority = "候補"

        else:

            priority = "対象外"

        application = job.get(
            "application_candidate"
        )

        if not isinstance(
            application,
            dict
        ):

            application = {}

        application["recommended"] = candidate

        application["priority"] = priority

        # AIが作った応募理由がない場合
        if not application.get(
            "reason"
        ):

            application["reason"] = (
                "AI適合度・自動化適性・"
                "リモート条件・報酬を総合評価した結果、"
                "応募候補として判定しました。"
            )

        if not isinstance(
            application.get(
                "questions"
            ),
            list
        ):

            application["questions"] = [
                "具体的な担当業務を教えてください。",
                "リモート勤務の条件を教えてください。",
                "AIツールや生成AIを利用した開発は可能でしょうか？",
                "AIによるコード生成・テスト自動化は許可されていますか？"
            ]

        job["application_candidate"] = application

        job["ai_only_work_priority"] = (
            ai_score >= 80
            and automation_score >= 70
            and remote_score >= 70
        )

    return jobs


# ============================================================
# jobs.json 保存
# ============================================================

def save_jobs(jobs):

    application_candidates = [
        job
        for job in jobs
        if job.get(
            "application_candidate",
            {}
        ).get(
            "recommended",
            False
        )
    ]

    output = {

        "source": SOURCE_URL,

        "search_conditions": {

            "keyword": "Python / AI / Web",

            "minimum_monthly_pay":
                MIN_MONTHLY_PAY,

            "minimum_ai_score":
                MIN_AI_SCORE,

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

        "application_candidate_count":
            len(application_candidates),

        "jobs": jobs
    }

    with open(
        OUTPUT_FILE,
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
    print("========================================")
    print("求人検索AI 完了")
    print("========================================")

    print(
        f"条件通過案件: {len(jobs)}件"
    )

    print(
        f"応募候補: {len(application_candidates)}件"
    )

    print("")

    for job in jobs:

        application = job.get(
            "application_candidate",
            {}
        )

        print(
            f"{job.get('rank')}位 | "
            f"{job.get('title')} | "
            f"月{job.get('monthly_pay', 0):,}円 | "
            f"AI:{job.get('score', 0)} | "
            f"自動化:{job.get('automation_score', 0)} | "
            f"リモート:{job.get('remote_score', 0)} | "
            f"総合:{job.get('ranking_score', 0)} | "
            f"応募:{application.get('priority', '対象外')}"
        )

    print("")
    print(
        f"{OUTPUT_FILE} を作成しました"
    )


# ============================================================
# メイン
# ============================================================

def main():

    print("========================================")
    print("AI求人検索・応募候補作成AI")
    print("========================================")

    page_text = fetch_jobs()

    jobs = analyze_jobs(
        page_text
    )

    jobs = remove_duplicates(
        jobs
    )

    print(
        f"重複削除後: {len(jobs)}件"
    )

    jobs = filter_jobs(
        jobs
    )

    print(
        f"条件通過: {len(jobs)}件"
    )

    jobs = rank_jobs(
        jobs
    )

    jobs = prepare_application_candidates(
        jobs
    )

    save_jobs(
        jobs
    )


# ============================================================
# 実行
# ============================================================

if __name__ == "__main__":

    main()