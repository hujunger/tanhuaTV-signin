let domain = "https://navix.site"; // 机场域名已固定
let loginCookies = "SESSION=M2E4YWQ3ZjQtN2E0Ni00Yjk3LWI5OGEtYzdjZWFlNzJhMmEx; loginToken=UID1939_0913a79b81af453db4a2431fafdf2ea6"; // 手动填入的Cookie
let user = "这里填邮箱";
let pass = "这里填密码";
let checkinResult;
let BotToken = '';
let ChatID = '';

export default {
    async fetch(request, env, ctx) {
        await initializeVariables(env);
        const url = new URL(request.url);
        if (url.pathname == "/tg") {
            await sendMessage();
        } else if (url.pathname == `/${pass}`) {
            await checkin();
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
            await checkin();
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
    loginCookies = env.COOKIES || loginCookies; // 环境变量优先
    const displayUser = user.length > 6 ? `${user.substring(0, 3)}****${user.substring(user.length - 3)}` : user;
    const displayPass = pass.length > 4 ? `${pass.substring(0, 1)}****${pass.substring(pass.length - 1)}` : pass;
    const displayCookies = loginCookies ? `${loginCookies.substring(0, 10)}****` : "未填写";
    checkinResult = `地址: ${domain}\n账号: ${displayUser}\n密码: ${displayPass}\n\nCookie: ${displayCookies}\nTG推送: ${ChatID ? `${ChatID.substring(0, 1)}****${ChatID.substring(ChatID.length - 3)}` : "未启用"}`;
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

async function checkin() {
    try {
        if (!domain || !loginCookies) {
            throw new Error('必需的配置参数缺失 (Navix.site)，请手动填入 Cookies');
        }

        console.log('Using provided cookies for check-in:', loginCookies);

        // --- 直接使用提供的 Cookie 执行签到请求 ---
        const checkinUrl = `${domain}/api/sign-in`;
        console.log(`Attempting check-in to ${checkinUrl}`);

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

        console.log('Navix.site Checkin Response Status:', checkinResponse.status);

        const checkinResponseText = await checkinResponse.text();
        console.log('Navix.site Checkin Raw Response:', checkinResponseText);

        try {
            const checkinJson = JSON.parse(checkinResponseText);
            console.log('Navix.site Checkin Result JSON:', checkinJson);

            if (checkinJson.code === 1) {
                checkinResult = `🎉 Navix.site 签到成功！ ${checkinJson.message || ''}`;
            } else if (checkinJson.code === 0 && checkinJson.message && checkinJson.message.includes('今日已签到')) {
                checkinResult = `ℹ️ Navix.site 今日已签到。`;
            } else {
                checkinResult = `🤔 Navix.site 签到失败或结果未知: ${checkinJson.message || '未知消息'}`;
            }
        } catch (e) {
            console.error('签到响应不是有效的 JSON。意外的响应格式或错误。');
            checkinResult = `❌ Navix.site 签到响应解析失败: ${e.message}. 原始响应: ${checkinResponseText.substring(0, 200)}...`;
            if (checkinResponseText.includes('未登录') || checkinResponseText.includes('请先登录')) {
                 checkinResult += ` (可能登录失效或会话过期)`;
            }
        }

        await sendMessage(checkinResult);
        return checkinResult;

    } catch (error) {
        console.error('Navix.site Checkin Error:', error);
        checkinResult = `Navix.site 签到过程发生错误: ${error.message}`;
        await sendMessage(checkinResult);
        return checkinResult;
    }
}
