import os
import json
import requests
from bs4 import BeautifulSoup
from openai import OpenAI

URL = "https://tech-agent.lancers.jp/project?q_text=Python"

client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"]
)

headers = {
    "User-Agent": "Mozilla/5.0"
}

response = requests.get(
    URL,
    headers=headers,
    timeout=30
)

response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")
text = soup.get_text("\n", strip=True)

prompt = f"""
あなたは案件選別AIです。

以下の公開案件情報から、
Python・AI・Web開発に関係する案件を抽出してください。

各案件について必ず以下のJSON形式で返してください。

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

ページ情報:
{text[:30000]}
"""

response = client.responses.create(
    model="gpt-5-mini",
    input=prompt
)

ai_result = response.output_text

# AIの回答をJSONとして読み込む
try:
    jobs = json.loads(ai_result)
except json.JSONDecodeError:
    print("AIの結果をJSONとして読み込めませんでした")
    print(ai_result)
    raise

# 80点以上だけ残す
recommended_jobs = [
    job for job in jobs
    if isinstance(job.get("score"), (int, float))
    and job["score"] >= 80
]

# jobs.jsonに保存
data = {
    "source": URL,
    "count": len(recommended_jobs),
    "jobs": recommended_jobs
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

print(f"取得案件数: {len(jobs)}")
print(f"80点以上のおすすめ案件: {len(recommended_jobs)}")
print("jobs.json を作成しました")