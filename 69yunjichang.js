let domain = "这里填机场域名";
let user = "这里填邮箱";
let pass = "这里填密码";
let 签到结果;
let BotToken = '';
let ChatID = '';

export default {
    // HTTP 请求处理函数保持不变
    async fetch(request, env, ctx) {
        await initializeVariables(env);
        const url = new URL(request.url);
        if (url.pathname == "/tg") {
            await sendMessage();
        } else if (url.pathname == `/${pass}`) {
            await checkin();
        }
        return new Response(签到结果, {
            status: 200,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        });
    },

    // 定时任务处理函数
    async scheduled(controller, env, ctx) {
        console.log('Cron job started');
        try {
            await initializeVariables(env);
            await checkin();
            console.log('Cron job completed successfully');
        } catch (error) {
            console.error('Cron job failed:', error);
            签到结果 = `定时任务执行失败: ${error.message}`;
            await sendMessage(签到结果);
        }
    },
};

async function initializeVariables(env) {
    domain = env.JC || env.DOMAIN || domain;
    user = env.ZH || env.USER || user;
    pass = env.MM || env.PASS || pass;
    if (!domain.includes("//")) domain = `https://${domain}`;
    BotToken = env.TGTOKEN || BotToken;
    ChatID = env.TGID || ChatID;
    签到结果 = `地址: ${domain.substring(0, 9)}****${domain.substring(domain.length - 5)}\n账号: ${user.substring(0, 1)}****${user.substring(user.length - 5)}\n密码: ${pass.substring(0, 1)}****${pass.substring(pass.length - 1)}\n\nTG推送: ${ChatID ? `${ChatID.substring(0, 1)}****${ChatID.substring(ChatID.length - 3)}` : "未启用"}`;
}

async function sendMessage(msg = "") {
    const 账号信息 = `地址: ${domain}\n账号: ${user.substring(0, 1)}****${user.substring(user.length - 5)}\n密码: ${pass.substring(0, 1)}****${pass.substring(pass.length - 1)}\n`;
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const formattedTime = beijingTime.toISOString().slice(0, 19).replace('T', ' ');
    console.log(msg);
    if (BotToken !== '' && ChatID !== '') {
        const url = `https://api.telegram.org/bot${BotToken}/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent("执行时间: " + formattedTime + "\n" + 账号信息 + "\n\n" + msg)}`;
        return fetch(url, {
            method: 'get',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;',
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72'
            }
        });
    } else if (ChatID !== "") {
        const url = `https://api.tg.090227.xyz/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent("执行时间: " + formattedTime + "\n" + 账号信息 + "\n\n" + msg)}`;
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

// checkin 函数修改
async function checkin() {
    try {
        if (!domain || !user || !pass) {
            throw new Error('必需的配置参数缺失');
        }

        // 登录请求
        const loginResponse = await fetch(`${domain}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': domain,
                'Referer': `${domain}/auth/login`,
            },
            body: JSON.stringify({
                email: user,
                passwd: pass,
                remember_me: 'on',
                code: "",
            }),
        });

        if (!loginResponse.ok) {
            const errorText = await loginResponse.text();
            throw new Error(`登录请求失败: ${errorText}`);
        }

        const loginJson = await loginResponse.json();
        if (loginJson.ret !== 1) {
            throw new Error(`登录失败: ${loginJson.msg || '未知错误'}`);
        }

        const cookieHeader = loginResponse.headers.get('set-cookie');
        if (!cookieHeader) {
            throw new Error('登录成功但未收到Cookie');
        }
        const cookies = cookieHeader.split(',').map(cookie => cookie.split(';')[0]).join('; ');

        // 等待确保登录状态
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 签到请求
        const checkinResponse = await fetch(`${domain}/user/checkin`, {
            method: 'POST',
            headers: {
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Origin': domain,
                'Referer': `${domain}/user/panel`,
                'X-Requested-With': 'XMLHttpRequest'
            },
        });

        const checkinText = await checkinResponse.text();
        let checkinResult;
        try {
            checkinResult = JSON.parse(checkinText);
        } catch (e) {
            throw new Error(`解析签到响应失败: ${checkinText}`);
        }

        // 获取用户面板页面并提取流量
        const userPanelResponse = await fetch(`${domain}/user`, {
            method: 'GET',
            headers: {
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                'Referer': `${domain}/user/panel`
            }
        });

        if (!userPanelResponse.ok) {
            throw new Error('获取用户面板页面失败');
        }

        const userPanelHtml = await userPanelResponse.text();

        // ------------------------- 新的抓取逻辑 -------------------------
        // 匹配包含“剩余流量”的整个 div
        const remainingBlockRegex = /<div class="d-flex flex-column ml-3 mr-5">.*?<p class="text-dark-50">剩余流量<\/p>.*?<\/div>/s;
        const remainingBlockMatch = userPanelHtml.match(remainingBlockRegex);
        
        let remainingTrafficInfo = "无法获取剩余流量";
        if (remainingBlockMatch && remainingBlockMatch[0]) {
            // 在找到的 div 中再寻找 <strong> 标签
            const valueRegex = /<strong>(.*?)<\/strong>/;
            const valueMatch = remainingBlockMatch[0].match(valueRegex);
            if (valueMatch && valueMatch[1]) {
                remainingTrafficInfo = `剩余流量：${valueMatch[1].trim()}`;
            }
        }

        // 匹配已用流量
        const usedTrafficRegex = /已用流量：(.*?)\s*<\/p>/;
        const usedMatch = userPanelHtml.match(usedTrafficRegex);
        
        let usedTrafficInfo = "无法获取已用流量";
        if (usedMatch && usedMatch[1]) {
            usedTrafficInfo = `已用流量：${usedMatch[1].trim()}`;
        }
        // -----------------------------------------------------------
        
        // 拼接最终结果
        const checkinMsg = checkinResult.msg || (checkinResult.ret === 1 ? '签到成功' : '签到失败');
        签到结果 = `🎉 签到结果 🎉\n${checkinMsg}\n\n${remainingTrafficInfo}\n${usedTrafficInfo}`;

        await sendMessage(签到结果);
        return 签到结果;

    } catch (error) {
        console.error('Checkin Error:', error);
        签到结果 = `签到过程发生错误: ${error.message}`;
        await sendMessage(签到结果);
        return 签到结果;
    }
}
