from openai import OpenAI
import os

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

response = client.responses.create(
    model="gpt-5-mini",
    input="求人検索AIの接続テストです。「接続成功」とだけ答えてください。"
)

print(response.output_text)