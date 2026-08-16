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

JOBS_FILE = "jobs.json"

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY")
)


# ============================================================
# 案件ページ取得
# ============================================================

def fetch_jobs():

    print("案件ページを取得しています...")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
            "AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) "
            "Version/18.0 Mobile/15E148 Safari/604.1"
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

    if not text:
        raise RuntimeError(
            "案件ページからテキストを取得できませんでした。"
        )

    print(
        f"取得文字数: {len(text)}"
    )

    return text


# ============================================================
# JSON抽出
# ============================================================

def clean_json_text(text):

    text = text.strip()

    # ```json ... ``` の除去
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

    # JSON配列を探す
    start = text.find("[")

    if start != -1:

        end = text.rfind("]")

        if end != -1:
            return text[start:end + 1]

    # JSONオブジェクトを探す
    start = text.find("{")

    if start != -1:

        end = text.rfind("}")

        if end != -1:
            return text[start:end + 1]

    return text


# ============================================================
# AI案件分析
# ============================================================

def analyze_jobs(page_text):

    print("AIで案件を分析しています...")

    system_prompt = """
あなたはPython・AI・Web開発案件を選別する専門AIです。

案件情報から、条件に合う案件を抽出してください。

重要条件：

・月額報酬50万円以上
・AIスコア80以上
・自動化スコア70以上
・Python / AI / Web開発を重視
・フルリモートを最優先
・リモート可を優先
・ハイブリッドはその次
・常駐は順位を下げる
・AIを使って開発作業を効率化しやすい案件を優先
・同じ案件を重複させない

AIだけで完全に仕事ができるとは判断しないでください。

設計判断、顧客とのコミュニケーション、
品質確認、契約、最終責任などは人間の確認が必要です。

以下を評価してください。

AI適合度
自動化適合度
リモート適合度
報酬
Python/Web適合度

さらに応募候補として使える場合は、
応募メッセージと確認質問を作成してください。

必ず有効なJSONだけを返してください。
説明文やMarkdownは返さないでください。
"""

    user_prompt = """
案件情報：

""" + page_text[:50000]

    response = client.responses.create(
        model=OPENAI_MODEL,
        instructions=system_prompt,
        input=user_prompt
    )

    result = response.output_text

    if not result:
        raise RuntimeError(
            "OpenAIから結果が返ってきませんでした。"
        )

    result = clean_json_text(result)

    try:

        jobs = json.loads(result)

    except json.JSONDecodeError as e:

        print("AIのJSON解析に失敗しました。")
        print(result[:3000])

        raise RuntimeError(
            f"JSON解析エラー: {e}"
        )

    if isinstance(jobs, dict):

        if "jobs" in jobs:
            jobs = jobs["jobs"]
        else:
            jobs = [jobs]

    if not isinstance(jobs, list):

        raise RuntimeError(
            "AIの返却データが案件リストではありません。"
        )

    print(
        f"AI抽出件数: {len(jobs)}"
    )

    return jobs


# ============================================================
# 数値変換
# ============================================================

def to_int(value):

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value)

    if value is None:
        return 0

    text = str(value)

    text = text.replace(
        ",",
        ""
    )

    text = text.replace(
        "円",
        ""
    )

    text = text.replace(
        "万円",
        ""
    )

    numbers = re.findall(
        r"\d+",
        text
    )

    if not numbers:
        return 0

    try:
        return int(
            "".join(numbers)
        )
    except Exception:
        return 0


# ============================================================
# 月額報酬
# ============================================================

def normalize_monthly_pay(job):

    pay = job.get(
        "monthly_pay",
        0
    )

    pay = to_int(pay)

    # 50万円などのケース
    reward_text = str(
        job.get(
            "reward",
            ""
        )
    )

    if pay == 0:

        if "万円" in reward_text:

            numbers = re.findall(
                r"\d+(?:\.\d+)?",
                reward_text
            )

            if numbers:

                try:

                    pay = int(
                        float(numbers[-1]) * 10000
                    )

                except Exception:
                    pay = 0

        elif "円" in reward_text:

            numbers = re.findall(
                r"\d[\d,]*",
                reward_text
            )

            if numbers:

                try:

                    pay = int(
                        numbers[-1].replace(
                            ",",
                            ""
                        )
                    )

                except Exception:
                    pay = 0

    job["monthly_pay"] = pay

    return job


# ============================================================
# 条件フィルター
# ============================================================

def filter_jobs(jobs):

    filtered = []

    for job in jobs:

        job = normalize_monthly_pay(
            job
        )

        score = to_int(
            job.get(
                "score",
                0
            )
        )

        automation_score = to_int(
            job.get(
                "automation_score",
                0
            )
        )

        job["score"] = score
        job["automation_score"] = automation_score

        if job["monthly_pay"] < MIN_MONTHLY_PAY:
            continue

        if job["score"] < MIN_AI_SCORE:
            continue

        if job["automation_score"] < MIN_AUTOMATION_SCORE:
            continue

        filtered.append(job)

    print(
        f"条件通過件数: {len(filtered)}"
    )

    return filtered


# ============================================================
# リモートスコア
# ============================================================

def calculate_remote_score(remote):

    text = str(
        remote or ""
    ).lower()

    if (
        "フルリモート" in text
        or "完全リモート" in text
    ):
        return 100

    if (
        "リモート可" in text
        or "リモートワーク" in text
    ):
        return 90

    if "ハイブリッド" in text:
        return 80

    if "リモート" in text:
        return 70

    if "常駐" in text:
        return 20

    return 40


# ============================================================
# 報酬スコア
# ============================================================

def calculate_pay_score(monthly_pay):

    pay = to_int(
        monthly_pay
    )

    # 50万円 = 0
    # 110万円以上 = 100

    score = (
        (pay - 500000)
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

        ai_score = to_int(
            job.get(
                "score",
                0
            )
        )

        automation_score = to_int(
            job.get(
                "automation_score",
                0
            )
        )

        remote_score = calculate_remote_score(
            job.get(
                "remote",
                ""
            )
        )

        pay_score = calculate_pay_score(
            job.get(
                "monthly_pay",
                0
            )
        )

        job["remote_score"] = remote_score

        job["pay_score"] = pay_score

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

    print(
        "応募候補を作成しています..."
    )

    for job in jobs:

        # 既にある場合は再利用
        existing = job.get(
            "application_candidate"
        )

        if isinstance(
            existing,
            dict
        ):
            continue

        title = job.get(
            "title",
            ""
        )

        description = job.get(
            "description",
            ""
        )

        remote = job.get(
            "remote",
            ""
        )

        prompt = """
以下の案件について、
応募候補情報を作成してください。

案件名：
""" + title + """

案件内容：
""" + description + """

リモート：
""" + remote + """

重要：
応募者が実際に持っている経験を確認していないため、
存在しない実績を断定しないでください。

「経験があります」などの表現は、
ユーザーが実際に経験していると確認できていない場合は
避けてください。

応募文は、
「案件内容に興味がある」
「対応可能な技術領域」
「詳しく確認したい内容」
を中心にしてください。

JSONだけを返してください。

形式：

{
  "recommended": true,
  "priority": "high",
  "reason": "",
  "application_message": "",
  "questions": [
    "",
    "",
    ""
  ]
}
"""

        try:

            response = client.responses.create(
                model=OPENAI_MODEL,
                instructions=(
                    "あなたは案件応募文を作成するアシスタントです。"
                    "JSONだけを返してください。"
                ),
                input=prompt
            )

            result = clean_json_text(
                response.output_text
            )

            candidate = json.loads(
                result
            )

            job[
                "application_candidate"
            ] = candidate

        except Exception as e:

            print(
                f"応募候補作成エラー: {e}"
            )

            job[
                "application_candidate"
            ] = {
                "recommended": False,
                "priority": "unknown",
                "reason": (
                    "応募文の自動生成に失敗しました。"
                ),
                "application_message": "",
                "questions": []
            }

    return jobs


# ============================================================
# Slack通知
# ============================================================

def send_slack_notification(top_job):

    if not SLACK_WEBHOOK_URL:

        print(
            "SLACK_WEBHOOK_URL が設定されていないため、"
            "Slack通知をスキップします。"
        )

        return False

    title = top_job.get(
        "title",
        "案件"
    )

    reward = top_job.get(
        "reward",
        ""
    )

    monthly_pay = top_job.get(
        "monthly_pay",
        0
    )

    remote = top_job.get(
        "remote",
        ""
    )

    ranking_score = top_job.get(
        "ranking_score",
        0
    )

    ai_score = top_job.get(
        "score",
        0
    )

    automation_score = top_job.get(
        "automation_score",
        0
    )

    message = (
        "🚨 AI案件ランキング1位を発見\n\n"
        f"【案件】{title}\n"
        f"【報酬】{reward}\n"
        f"【月額】{monthly_pay:,}円\n"
        f"【リモート】{remote}\n"
        f"【AIスコア】{ai_score}\n"
        f"【自動化スコア】{automation_score}\n"
        f"【ランキング】{ranking_score}\n\n"
        f"【案件ページ】{SOURCE_URL}"
    )

    payload = {
        "text": message
    }

    try:

        response = requests.post(
            SLACK_WEBHOOK_URL,
            json=payload,
            timeout=30
        )

        response.raise_for_status()

        print(
            "Slack通知成功"
        )

        return True

    except Exception as e:

        print(
            f"Slack通知に失敗しました: {e}"
        )

        return False


# ============================================================
# jobs.json保存
# ============================================================

def save_jobs(jobs):

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

        "application_candidate_count": sum(
            1
            for job in jobs
            if job.get(
                "application_candidate",
                {}
            ).get(
                "recommended",
                False
            )
        ),

        "jobs": jobs
    }

    with open(
        JOBS_FILE,
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

    for job in jobs:

        print(
            f"{job.get('rank')}位 "
            f"{job.get('title')} "
            f"月{job.get('monthly_pay', 0):,}円 "
            f"AI:{job.get('score', 0)} "
            f"自動化:{job.get('automation_score', 0)} "
            f"リモート:{job.get('remote_score', 0)} "
            f"総合:{job.get('ranking_score', 0)}"
        )

    print(
        f"{JOBS_FILE} を作成しました"
    )


# ============================================================
# メイン
# ============================================================

def main():

    print(
        "================================"
    )

    print(
        "AI求人検索システム開始"
    )

    print(
        "================================"
    )

    if not os.environ.get(
        "OPENAI_API_KEY"
    ):

        raise RuntimeError(
            "OPENAI_API_KEY が設定されていません。"
        )

    try:

        # 1. 案件取得
        page_text = fetch_jobs()

        # 2. AI分析
        jobs = analyze_jobs(
            page_text
        )

        # 3. 条件フィルター
        jobs = filter_jobs(
            jobs
        )

        # 4. ランキング
        jobs = rank_jobs(
            jobs
        )

        # 5. 応募候補作成
        jobs = create_application_candidates(
            jobs
        )

        # 6. 保存
        save_jobs(
            jobs
        )

        # 7. 1位をSlack通知
        if jobs:

            top_job = jobs[0]

            print(
                "ランキング1位:"
            )

            print(
                top_job.get(
                    "title",
                    ""
                )
            )

            send_slack_notification(
                top_job
            )

        else:

            print(
                "条件に合う案件がありませんでした。"
            )

        print(
            "処理が正常終了しました。"
        )

    except Exception as e:

        print(
            "================================"
        )

        print(
            "求人検索AI エラー"
        )

        print(
            "================================"
        )

        print(
            str(e)
        )

        raise


# ============================================================
# 実行
# ============================================================

if __name__ == "__main__":

    main()