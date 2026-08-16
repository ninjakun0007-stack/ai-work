from openai import OpenAI
import os
import json

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

jobs = [
    {
        "title": "Python Web開発",
        "description": "PythonとFastAPIを使ったWebサービス開発。リモート可能。",
        "reward": "月60万円〜80万円"
    },
    {
        "title": "AI業務自動化開発",
        "description": "生成AIとPythonを使った業務自動化ツールの開発。",
        "reward": "月50万円〜80万円"
    },
    {
        "title": "Webサイト更新作業",
        "description": "既存Webサイトの更新と簡単なHTML修正。",
        "reward": "月25万円〜35万円"
    }
]

prompt = f"""
あなたは案件選別AIです。

目的：
Python・AI・Web開発の仕事を見つけること。

以下の案件を100点満点で評価してください。

評価基準：
- Python / AI / Web開発との関連性
- 報酬
- リモート可能性
- 作業内容の明確さ
- AIによる自動化・開発との相性

80点以上を「おすすめ案件」としてください。

結果はJSON形式で返してください。

案件：
{json.dumps(jobs, ensure_ascii=False)}
"""

response = client.responses.create(
    model="gpt-5-mini",
    input=prompt
)

result = {
    "ai_result": response.output_text
}

with open("jobs.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(response.output_text)
print("案件選別完了")