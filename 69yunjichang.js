// =========================================================================================
// ==                                 Configuration                                     ==
// =========================================================================================
// Telegram Bot Configuration (Recommended to set via Worker Environment Variables)
let BotToken = ''; // e.g., '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
let ChatID = '';   // e.g., '123456789'

// The key used to store the accounts list in the KV namespace.
const KV_ACCOUNTS_KEY = "ACCOUNTS_CONFIG";


// =========================================================================================
// ==                             Core Worker Logic                                     ==
// =========================================================================================

export default {
    async fetch(request, env, ctx) {
        // Essential: Initialize shared configurations from environment variables
        await initializeConfig(env);
        const url = new URL(request.url);

        // Routing
        if (url.pathname === "/admin") {
            return handleAdminRequest(request, env);
        }
        if (url.pathname === "/checkin" || url.pathname === "/tg") {
            const results = await processAllAccounts(env);
            return new Response(results.join('\n\n---\n\n'), {
                status: 200,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
            });
        }
        
// Get the origin (e.g., https://your.worker.dev) from the request URL
const { origin } = new URL(request.url);

// Create the HTML response body
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>69云机场自动签到脚本</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
            background-color: #f0f2f5;
            text-align: center;
        }
        .container { 
            background: #fff; 
            padding: 2rem 3rem; 
            border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
        }
        h1 { margin-top: 0; color: #333; }
        p { color: #555; }
        ul { list-style: none; padding: 0; margin-top: 1.5rem; }
        li { margin-bottom: 1rem; }
        a { 
            text-decoration: none; 
            color: #007bff;
            font-size: 1.1rem;
            font-weight: 500;
        }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ 脚本正在运行······</h1>
        <ul>
            <li><a href="${origin}/checkin">手动签到</a></li>
            <li><a href="${origin}/admin">管理账户</a></li>
        </ul>
    </div>
</body>
</html>`;

return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
});
    },

    async scheduled(controller, env, ctx) {
        console.log('Cron job started for all accounts');
        await initializeConfig(env);
        await processAllAccounts(env);
        console.log('Cron job completed for all accounts');
    }
};

/**
 * Handles requests to the /admin endpoint for configuration using the POST method for security.
 * @param {Request} request The incoming request
 * @param {object} env The environment variables and bindings
 * @returns {Response} An HTML response for the admin page or a redirect
 */
async function handleAdminRequest(request, env) {
    const adminPassword = env.ADMIN_PASSWORD;
    if (!adminPassword) {
        return new Response("ADMIN_PASSWORD is not set. Please configure it in Worker secrets.", { status: 500 });
    }
     if (!env.SETTINGS_KV) {
        return new Response("KV namespace 'SETTINGS_KV' is not bound. Please configure it in Worker settings.", { status: 500 });
    }

    // Handle POST requests for both login and saving data
    if (request.method === 'POST') {
        const formData = await request.formData();
        const password = formData.get('password');
        const action = formData.get('action');

        if (password !== adminPassword) {
            return new Response(getLoginPage(true), { status: 403, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
        }

        // Action 'save': handle saving the account configurations
        if (action === 'save') {
            const accounts = [];
            let i = 0;
            while (formData.has(`domain_${i}`)) {
                const domain = formData.get(`domain_${i}`);
                const user = formData.get(`user_${i}`);
                const pass = formData.get(`pass_${i}`);
                if (domain && user && pass) {
                    accounts.push({ domain, user, pass });
                }
                i++;
            }
            
            await env.SETTINGS_KV.put(KV_ACCOUNTS_KEY, JSON.stringify(accounts, null, 2));
            // After saving, show the editor page again with a success message
            const savedAccounts = await getAccountsFromKV(env);
            return new Response(getEditorPage(savedAccounts, adminPassword, true), {
                headers: { 'Content-Type': 'text/html;charset=UTF-8' },
            });
        }
        
        // Default POST action is login: show the editor page
        const accounts = await getAccountsFromKV(env);
        return new Response(getEditorPage(accounts, adminPassword, false), {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
    }

    // For GET requests, always show the login page.
    return new Response(getLoginPage(false), { headers: { 'Content-Type': 'text/html;charset=UTF-8' }});
}


/**
 * Fetches the list of accounts from the bound KV namespace.
 * @param {object} env The environment variables and bindings
 * @returns {Promise<Array>} A promise that resolves to the array of accounts.
 */
async function getAccountsFromKV(env) {
    const accountsJson = await env.SETTINGS_KV.get(KV_ACCOUNTS_KEY);
    return accountsJson ? JSON.parse(accountsJson) : [];
}


/**
 * Initializes configuration from environment variables.
 * @param {object} env The environment variables and bindings
 */
async function initializeConfig(env) {
    BotToken = env.TGTOKEN || BotToken;
    ChatID = env.TGID || ChatID;
}

/**
 * Fetches accounts from KV and runs the check-in process for each.
 * @param {object} env The environment variables and bindings
 * @returns {Promise<string[]>} A promise that resolves to an array of result strings
 */
async function processAllAccounts(env) {
    const allResults = [];
    let accounts = [];
    
    try {
        if (!env.SETTINGS_KV) {
             throw new Error("KV namespace 'SETTINGS_KV' is not bound.");
        }
        accounts = await getAccountsFromKV(env);
    } catch (e) {
        const errorMsg = `Error reading accounts from KV: ${e.message}`;
        console.error(errorMsg);
        await sendMessage(errorMsg);
        return [errorMsg];
    }

    if (!accounts || accounts.length === 0) {
        const errorMsg = "错误：未在KV中配置任何账户。请访问 /admin 页面进行配置。";
        console.error(errorMsg);
        await sendMessage(errorMsg);
        return [errorMsg];
    }

    for (const account of accounts) {
        if (account.domain && !account.domain.startsWith('http')) {
            account.domain = `https://${account.domain}`;
        }
        const result = await checkin(account);
        allResults.push(result);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between accounts
    }
    return allResults;
}


/**
 * Sends a Telegram message.
 * @param {string} msg The message content
 * @param {object} [account=null] The account object for context
 */
async function sendMessage(msg, account = null) {
    let header = "";
    if (account) {
        const maskedUser = account.user.substring(0, 1) + '****' + account.user.substring(account.user.length - 5);
        header += `地址: ${account.domain}\n账号: ${maskedUser}\n`;
    }

    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const formattedTime = beijingTime.toISOString().slice(0, 19).replace('T', ' ');
    const fullMessage = `执行时间: ${formattedTime}\n${header}\n${msg}`;
    
    console.log(fullMessage);

    if (BotToken && ChatID) {
        const url = `https://api.telegram.org/bot${BotToken}/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent(fullMessage)}`;
        await fetch(url).catch(e => console.error("Telegram API fetch failed:", e));
    }
}

/**
 * Performs the check-in for a single account.
 * @param {object} account The account object with domain, user, and pass
 * @returns {Promise<string>} The result of the check-in process
 */
async function checkin(account) {
    let checkinResultText;
    const { domain, user, pass } = account;

    try {
        if (!domain || !user || !pass) {
            throw new Error('账户信息不完整 (domain, user, pass 都是必需的)');
        }

        const loginResponse = await fetch(`${domain}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': domain,
                'Referer': `${domain}/auth/login`,
            },
            body: JSON.stringify({ email: user, passwd: pass, remember_me: 'on' }),
        });

        if (!loginResponse.ok) throw new Error(`登录请求失败: ${loginResponse.status} ${loginResponse.statusText}`);
        
        const loginJson = await loginResponse.json();
        if (loginJson.ret !== 1) throw new Error(`登录失败: ${loginJson.msg || '未知错误'}`);

        const cookieHeader = loginResponse.headers.get('set-cookie');
        if (!cookieHeader) throw new Error('登录成功但未收到Cookie');
        const cookies = cookieHeader.split(',').map(cookie => cookie.split(';')[0]).join('; ');

        await new Promise(resolve => setTimeout(resolve, 500));

        const checkinResponse = await fetch(`${domain}/user/checkin`, {
            method: 'POST',
            headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });

        const checkinResult = await checkinResponse.json();
        
        const userPanelResponse = await fetch(`${domain}/user`, {
            method: 'GET',
            headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0' }
        });
        if (!userPanelResponse.ok) throw new Error('获取用户面板页面失败');
        
        const userPanelHtml = await userPanelResponse.text();
        
        let trafficDetails = "未能解析流量信息";
        const remainingRegex = /<div class="d-flex flex-column ml-3 mr-5">.*?<strong>([\d.]+)\s*(GB|MB|TB)<\/strong>.*?<p class="text-dark-50">剩余流量<\/p>.*?<\/div>/s;
        const usedRegex = /已用流量：([\d.]+)\s*(GB|MB|TB)\s*<\/p>/;
        const remainingMatch = userPanelHtml.match(remainingRegex);
        const usedMatch = userPanelHtml.match(usedRegex);

        if (usedMatch && remainingMatch) {
            const usedValue = parseFloat(usedMatch[1]);
            const usedUnit = usedMatch[2];
            const remainingValue = parseFloat(remainingMatch[1]);
            const remainingUnit = remainingMatch[2];

            const convertToGB = (v, u) => (u.toUpperCase() === 'TB' ? v * 1024 : u.toUpperCase() === 'MB' ? v / 1024 : v);
            const createBar = p => `[${'■'.repeat(Math.round(p/10))}${'□'.repeat(10-Math.round(p/10))}]`;

            const usedGB = convertToGB(usedValue, usedUnit);
            const remainingGB = convertToGB(remainingValue, remainingUnit);
            const totalGB = usedGB + remainingGB;
            const percentage = totalGB > 0 ? (usedGB / totalGB) * 100 : 0;
            
            trafficDetails = `流量详情: ${usedGB.toFixed(2)} GB / ${totalGB.toFixed(2)} GB\n使用进度: ${createBar(percentage)} ${percentage.toFixed(1)}%`;
        }

        const checkinMsg = checkinResult.msg || (checkinResult.ret === 1 ? '签到成功' : '签到失败');
        checkinResultText = `🎉 签到结果 🎉\n${checkinMsg}\n\n${trafficDetails}`;

    } catch (error) {
        console.error(`账户 ${user} 在 ${domain} 的签到过程中发生错误:`, error);
        checkinResultText = `签到过程发生错误: ${error.message}`;
    }
    
    await sendMessage(checkinResultText, account);
    return `账户: ${user}\n结果: ${checkinResultText}`;
}


// =========================================================================================
// ==                          Admin Page HTML Generation                               ==
// =========================================================================================

function getLoginPage(hasError = false) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>账户管理</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
        .login-container { background: #fff; padding: 2rem 2.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; }
        h1 { margin-top: 0; color: #333; }
        p { color: #d93025; margin-bottom: 1rem; font-weight: 500; }
        form { display: flex; flex-direction: column; gap: 1rem; }
        input[type="password"] { padding: 0.75rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem; }
        input[type="submit"] { padding: 0.75rem 1rem; border: none; background-color: #007bff; color: white; border-radius: 4px; cursor: pointer; font-size: 1rem; font-weight: 500; }
        input[type="submit"]:hover { background-color: #0056b3; }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>管理员密码</h1>
        ${hasError ? '<p>Invalid Password. Please try again.</p>' : ''}
        <form method="POST" action="/admin">
            <input type="password" name="password" placeholder="请输入管理员密码" required>
            <input type="submit" value="登录">
        </form>
    </div>
</body>
</html>`;
}

function getEditorPage(accounts, password, isSaved) {
    let accountsHtml = accounts.map((acc, index) => `
        <div class="account-card" id="account-card-${index}">
            <button type="button" class="delete-btn" onclick="removeAccount(${index})">&times;</button>
            <h3>账号 ${index + 1}</h3>
            <div class="form-group">
                <label for="domain_${index}">机场域名 (Domain)</label>
                <input type="text" id="domain_${index}" name="domain_${index}" value="${acc.domain || ''}" placeholder="example.com" required>
            </div>
            <div class="form-group">
                <label for="user_${index}">邮箱 (User)</label>
                <input type="email" id="user_${index}" name="user_${index}" value="${acc.user || ''}" placeholder="user@example.com" required>
            </div>
            <div class="form-group">
                <label for="pass_${index}">密码 (Password)</label>
                <input type="password" id="pass_${index}" name="pass_${index}" value="${acc.pass || ''}" required>
            </div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>账户配置</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #333; }
        #accounts-container { display: grid; grid-template-columns: 1fr; gap: 20px; }
        .account-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; position: relative; background: #fafafa; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
        input[type="text"], input[type="email"], input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .btn { padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: 500; text-align: center; display: inline-block; }
        .btn-save { background-color: #28a745; color: white; width: 100%; margin-top: 10px; }
        .btn-add { background-color: #007bff; color: white; margin-top: 20px; }
        .delete-btn { position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 16px; line-height: 24px; text-align: center; }
        .notification { background-color: #d4edda; color: #155724; padding: 10px; border-radius: 5px; text-align: center; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>多账户签到配置</h1>
        ${isSaved ? '<div class="notification" id="notification">配置已成功保存！</div>' : ''}
        <form id="config-form" method="POST" action="/admin">
            <input type="hidden" name="password" value="${password}">
            <input type="hidden" name="action" value="save">
            <div id="accounts-container">
                ${accountsHtml}
            </div>
            <button type="button" class="btn btn-add" onclick="addAccount()">+ 添加新账户</button>
            <button type="submit" class="btn btn-save">保存所有配置</button>
        </form>
    </div>
    <script>
        let accountCounter = ${accounts.length};

        // Hide notification after a few seconds
        if (document.getElementById('notification')) {
            setTimeout(() => {
                document.getElementById('notification').style.display = 'none';
            }, 3000);
        }

        function addAccount() {
            const index = accountCounter++;
            const container = document.getElementById('accounts-container');
            const card = document.createElement('div');
            card.className = 'account-card';
            card.id = \`account-card-\${index}\`;
            card.innerHTML = \`
                <button type="button" class="delete-btn" onclick="removeAccount(\${index})">&times;</button>
                <h3>新账户</h3>
                <div class="form-group">
                    <label for="domain_\${index}">机场域名 (Domain)</label>
                    <input type="text" id="domain_\${index}" name="domain_\${index}" placeholder="example.com" required>
                </div>
                <div class="form-group">
                    <label for="user_\${index}">邮箱 (User)</label>
                    <input type="email" id="user_\${index}" name="user_\${index}" placeholder="user@example.com" required>
                </div>
                <div class="form-group">
                    <label for="pass_\${index}">密码 (Password)</label>
                    <input type="password" id="pass_\${index}" name="pass_\${index}" required>
                </div>
            \`;
            container.appendChild(card);
        }

        function removeAccount(index) {
            const card = document.getElementById(\`account-card-\${index}\`);
            if (card && confirm('确定要删除这个账户吗？')) {
                card.remove();
                // After removal, re-index all form elements to ensure data is posted correctly without gaps.
                reindexAccounts();
            }
        }

        function reindexAccounts() {
            const container = document.getElementById('accounts-container');
            const cards = container.querySelectorAll('.account-card');
            accountCounter = cards.length; // Reset counter
            cards.forEach((card, newIndex) => {
                card.id = \`account-card-\${newIndex}\`;
                card.querySelector('h3').textContent = \`Account \${newIndex + 1}\`;
                card.querySelector('.delete-btn').setAttribute('onclick', \`removeAccount(\${newIndex})\`);
                
                const labels = card.querySelectorAll('label');
                const inputs = card.querySelectorAll('input');

                // This is a robust way to re-index. We map old id to new id.
                const idMap = {};
                inputs.forEach(input => {
                    if (input.name) {
                        const baseName = input.name.split('_')[0];
                        const oldId = input.id;
                        const newId = \`\${baseName}_\${newIndex}\`;
                        idMap[oldId] = newId;
                        input.name = newId;
                        input.id = newId;
                    }
                });

                labels.forEach(label => {
                    const oldFor = label.getAttribute('for');
                    if (idMap[oldFor]) {
                        label.setAttribute('for', idMap[oldFor]);
                    }
                });
            });
        }
    </script>
</body>
</html>`;
}
