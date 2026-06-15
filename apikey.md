ce1e6ab5affe4b839b2412018f208782.mZPS0F4KlJAq3ttk

curl -X POST "https://open.bigmodel.cn/api/paas/v4/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your-api-key" \
    -d '{
        "model": "glm-5.1",
        "messages": [
        {
            "role": "user",
            "content": "作为一名营销专家，请为我的产品创作一个吸引人的口号"
        },
        {
            "role": "assistant",
            "content": "当然，要创作一个吸引人的口号，请告诉我一些关于您产品的信息"
        },
        {
            "role": "user",
            "content": "智谱AI 开放平台"
        }
            ],
            "thinking": {
            "type": "enabled"
        },
            "max_tokens": 65536,
            "temperature": 1.0
        }'