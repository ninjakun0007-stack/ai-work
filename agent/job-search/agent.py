from openai import OpenAI
import os

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

jobs = [
    {
        "title": "Python開発エンジニア",
        "description": "Pythonを使ったWebシステム開発。リモート勤務可能。",
        "reward": "月50万円〜70万円"
    },
    {
        "title": "データ入力スタッフ",
        "description": "Excelを使ったデータ入力。未経験歓迎。",
        "reward": "時給1,300円"
    },
    {
        "title": "AI開発アシスタント",
        "description": "生成AIを利用した業務自動化ツールの開発補助。",
        "reward": "月40万円〜60万円"
    }
]

prompt = f"""
あなたは求人検索AIです。

以下の求人を評価してください。

{jobs}

それぞれについて、
・おすすめ度（0〜100）
・おすすめ理由
・注意点

を日本語で簡潔に説明してください。
"""

response = client.responses.create(
    model="gpt-5-mini",
    input=prompt
)

print(response.output_text)