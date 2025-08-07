let domain = "https://navix.site"; // 机场域名已固定
let user = "这里填邮箱";
let pass = "这里填密码";
let checkinResult;
let BotToken = '';
let ChatID = '';

export default {
    async fetch(request, env, ctx) {
        await initializeVariables(env);
        const url = new URL(request.url);

        // 如果用户访问更新页面
        if (url.pathname == `/${pass}/update`) {
            if (request.method === 'POST') {
                return handleCookieUpdate(request, env);
            } else {
                return new Response(updateFormHtml(), {
                    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
                });
            }
        }

        // 其他请求处理（如TG推送和签到）
        if (url.pathname == "/tg") {
            await sendMessage();
        } else if (url.pathname == `/${pass}`) {
            await checkin(env);
        }

        return new Response(checkinResult, {
            status: 200,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        });
    },

    async scheduled(controller, env, ctx) {
        console.log('Cron job started for Navix.site');
        try {
            await initializeVariables(env);
            await checkin(env);
            console.log('Cron job completed successfully for Navix.site');
        } catch (error) {
            console.error('Cron job failed for Navix.site:', error);
            checkinResult = `定时任务执行失败: ${error.message}`;
            await sendMessage(checkinResult);
        }
    },
};

async function initializeVariables(env) {
    user = env.ZH || env.USER || user;
    pass = env.MM || env.PASS || pass;
    BotToken = env.TGTOKEN || BotToken;
    ChatID = env.TGID || ChatID;
    
    // 从 KV 空间读取 Cookies
    let loginCookies = await env.NAVIX_KV.get('loginCookies') || '';
    
    // 调试信息
    const displayUser = user.length > 6 ? `${user.substring(0, 3)}****${user.substring(user.length - 3)}` : user;
    const displayPass = pass.length > 4 ? `${pass.substring(0, 1)}****${pass.substring(pass.length - 1)}` : pass;
    const cookiesCount = loginCookies.split('&').length;
    
    checkinResult = `地址: ${domain}\n账号: ${displayUser}\n密码: ${displayPass}\n\nCookie数量: ${cookiesCount}\nTG推送: ${ChatID ? `${ChatID.substring(0, 1)}****${ChatID.substring(ChatID.length - 3)}` : "未启用"}`;
}

async function handleCookieUpdate(request, env) {
    try {
        const formData = await request.formData();
        const loginCookies = formData.get('loginCookies');
        
        if (!loginCookies) {
            return new Response('更新失败：Cookies 不能为空', { status: 400 });
        }

        await env.NAVIX_KV.put('loginCookies', loginCookies);

        const successHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>更新成功</title>
            </head>
            <body>
                <h1>Cookies 更新成功！</h1>
                <p>新的 Cookies 已保存到 KV 空间。</p>
                <a href="/${pass}/update">返回更新页面</a>
            </body>
            </html>
        `;
        return new Response(successHtml, {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });

    } catch (error) {
        return new Response(`更新失败: ${error.message}`, { status: 500 });
    }
}

function updateFormHtml() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>更新 Navix.site Cookies</title>
            <style>
                body { font-family: sans-serif; padding: 2em; line-height: 1.6; }
                form { max-width: 600px; margin: 0 auto; padding: 2em; border: 1px solid #ccc; border-radius: 8px; }
                label, input { display: block; margin-bottom: 1em; width: 100%; }
                input[type="text"] { padding: 0.5em; font-size: 1em; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
                button { padding: 0.75em 1.5em; font-size: 1em; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
                button:hover { background-color: #0056b3; }
            </style>
        </head>
        <body>
            <form method="POST">
                <h1>更新 Navix.site Cookies</h1>
                <p>请从浏览器开发者工具中复制完整的 Cookie 字符串。多个账号请用 & 符号连接。</p>
                <label for="loginCookies">Cookies (SESSION=...; loginToken=...&SESSION=...; loginToken=...):</label>
                <input type="text" id="loginCookies" name="loginCookies" placeholder="SESSION=xxx; loginToken=xxx&SESSION=yyy; loginToken=zzz">
                <button type="submit">提交并更新</button>
            </form>
        </body>
        </html>
    `;
}

async function sendMessage(msg = "") {
    const accountInfo = `地址: ${domain}\n账号: ${user.substring(0, 1)}****${user.substring(user.length - 5)}\n密码: ${pass.substring(0, 1)}****${pass.substring(pass.length - 1)}\n`;
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const formattedTime = beijingTime.toISOString().slice(0, 19).replace('T', ' ');
    console.log(msg);
    if (BotToken !== '' && ChatID !== '') {
        const url = `https://api.telegram.org/bot${BotToken}/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent("执行时间: " + formattedTime + "\n" + accountInfo + "\n\n" + msg)}`;
        return fetch(url, {
            method: 'get',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;',
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72'
            }
        });
    } else if (ChatID !== "") {
        const url = `https://api.tg.090227.xyz/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent("执行时间: " + formattedTime + "\n" + accountInfo + "\n\n" + msg)}`;
        return fetch(url, {
            method: 'get',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;',
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72'
            }
        });
    }
}

async function checkin(env) {
    let allResults = [];
    try {
        // 从 KV 空间读取 Cookie 字符串
        const combinedCookies = await env.NAVIX_KV.get('loginCookies');
        if (!combinedCookies) {
            throw new Error('必需的 Cookies 缺失，请访问更新页面设置。');
        }

        // 按 '&' 分割成多个账号的 Cookie 数组
        const cookiesArray = combinedCookies.split('&');
        console.log(`Processing ${cookiesArray.length} accounts...`);

        // 遍历数组，对每个账号进行签到
        for (const [index, loginCookies] of cookiesArray.entries()) {
            console.log(`\n--- Starting check-in for account ${index + 1} ---`);
            
            // --- 执行签到请求 ---
            const checkinUrl = `${domain}/api/sign-in`;
            const checkinResponse = await fetch(checkinUrl, {
                method: 'POST',
                headers: {
                    'Cookie': loginCookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                    'Origin': domain,
                    'Referer': `${domain}/sign_in`,
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Length': '0',
                    'Content-Type': 'application/json',
                },
                body: '',
            });

            console.log(`Account ${index + 1} Checkin Response Status:`, checkinResponse.status);

            const checkinResponseText = await checkinResponse.text();
            console.log(`Account ${index + 1} Checkin Raw Response:`, checkinResponseText);

            let currentResult;
            try {
                const checkinJson = JSON.parse(checkinResponseText);
                console.log(`Account ${index + 1} Checkin Result JSON:`, checkinJson);

                if (checkinJson.code === 1) {
                    currentResult = `🎉 账号 ${index + 1} 签到成功！ ${checkinJson.message || ''}`;
                } else if (checkinJson.code === 0 && checkinJson.message && checkinJson.message.includes('今日已签到')) {
                    currentResult = `ℹ️ 账号 ${index + 1} 今日已签到。`;
                } else {
                    currentResult = `🤔 账号 ${index + 1} 签到结果: ${checkinJson.message || '未知消息'}\n记得续期哦：https://tanhuatv.cfip.nyc.mn/`;
                }
            } catch (e) {
                console.error(`账号 ${index + 1} 签到响应解析失败。`);
                currentResult = `❌ 账号 ${index + 1} 签到响应解析失败: ${e.message}. 原始响应: ${checkinResponseText.substring(0, 200)}...`;
                if (checkinResponseText.includes('未登录') || checkinResponseText.includes('请先登录')) {
                    currentResult += ` (可能登录失效或会话过期)`;
                }
            }
            allResults.push(currentResult);
        }

        checkinResult = allResults.join('\n\n');
        await sendMessage(checkinResult);
        return checkinResult;

    } catch (error) {
        console.error('Navix.site Checkin Error:', error);
        checkinResult = `Navix.site 签到过程发生错误: ${error.message}`;
        await sendMessage(checkinResult);
        return checkinResult;
    }
}
