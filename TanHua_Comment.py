import requests
import time
import random  # 1. 导入 random 库

# --- 1. 需要你手动配置的区域 ---

# 评论的帖子ID范围 (包含起始和结束)
start_post_id = 5100
end_post_id = 6000

# 2. 备选评论内容的列表
comment_options = [
    '探花666',
    '感谢分享',
    '混点分',
    '想要一个账号',
    '50币好难啊',
    '这个好',
    '卧槽666',
    '卧槽牛逼',
    'nbnb'
]

# 你的 Cookie (直接从浏览器开发者工具中复制)
# 重要：Cookie会过期，需要定期更新
cookies_str = ''

# 每次评论后的等待时间（秒）
delay_seconds = 10

# --- 2. 脚本核心逻辑 (已增加随机评论功能) ---

# 将字符串Cookie转换为requests库可用的字典格式
try:
    cookies = {c.split('=')[0].strip(): c.split('=')[1].strip() for c in cookies_str.split(';')}
except IndexError:
    print("错误：Cookie 格式不正确。请确保它是 'key1=value1; key2=value2' 的形式。")
    exit()

# 目标URL
url = 'https://navix.site/comment/add'

# --- 开始循环评论 ---
# range(start, end + 1) 可以确保循环包含 end_post_id 本身
for post_id in range(start_post_id, end_post_id + 1):

    # 3. 在每次循环开始时，随机选择一条评论
    current_comment = random.choice(comment_options)
    current_post_id_str = str(post_id)  # 将数字ID转换为字符串

    print(f"--- [ {post_id}/{end_post_id} ] ---")
    print(f"准备向帖子ID: {current_post_id_str} 发表评论...")
    print(f"随机选择的评论内容: '{current_comment}'")  # 打印出本次选择的评论

    # 构造请求头，Referer需要每次循环都更新
    headers = {
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'Origin': 'https://navix.site',
        'Referer': f'https://navix.site/post/{current_post_id_str}',  # 动态更新Referer
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
    }

    # 构造表单数据，postId和content都需要每次循环都更新
    data_payload = {
        'postId': (None, current_post_id_str),
        'content': (None, current_comment),  # 使用随机选出的评论
    }

    try:
        # 发送POST请求
        response = requests.post(
            url,
            headers=headers,
            cookies=cookies,
            files=data_payload
        )

        # 检查响应
        print(f"请求完成，服务器响应状态码: {response.status_code}")

        # 尝试以JSON格式解析响应
        try:
            response_json = response.json()
            print(f"服务器返回内容: {response_json}")
            if response_json.get('code') != 200:
                print(f"警告：帖子 {current_post_id_str} 评论可能失败，消息: {response_json.get('msg')}")
        except requests.exceptions.JSONDecodeError:
            print(f"服务器返回非JSON内容，可能出错: {response.text[:200]}...")

    except requests.exceptions.RequestException as e:
        print(f"请求过程中发生错误: {e}")

    # --- 等待指定时间 ---
    if post_id < end_post_id:  # 如果不是最后一个，就等待
        print(f"评论完成，等待 {delay_seconds} 秒后继续...")
        print("-" * 20)  # 打印分隔符，让日志更清晰
        time.sleep(delay_seconds)

print("\n所有评论任务已执行完毕！")
