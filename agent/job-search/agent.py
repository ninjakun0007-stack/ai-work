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

# ページ全体から案件らしい情報をAIに渡す
prompt = f"""
あなたは求人・案件検索AIです。

以下はランサーズ テックエージェントの
Python案件検索ページから取得した公開情報です。

この中からPython・AI・Web開発に関係する案件を抽出してください。

各案件について以下をJSONで返してください。

- title
- reward
- description
- remote
- score
- recommended
- reason

scoreは0〜100。
80点以上ならrecommended=true。

ページ情報:
{text[:30000]}
"""

result = client.responses.create(
    model="gpt-5-mini",
    input=prompt
)

ai_result = result.output_text

# JSONとして保存
data = {
    "source": URL,
    "ai_result": ai_result
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

print("実際の公開案件を取得しました")
print(ai_result)
print("jobs.json を作成しました")