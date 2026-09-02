// ===== CORS 响应包装：IPA本地加载网页跨域访问后端必须 =====
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};
// 给任意 Response 追加 CORS 头
function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}
// 快捷：返回 JSON + CORS
function corsJson(data, status = 200) {
  return withCors(new Response(JSON.stringify(data), {
    status: status,
    headers: { "Content-Type": "application/json;charset=utf-8" }
  }));
}

export default {
 async fetch(request, env) {
    // ========== CORS 预检请求 OPTIONS ==========
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ========== 登录密码配置 ==========
    const USERNAME = "admin";   // 自定义用户名
    const PASSWORD = "123456";  // 自定义密码
    // 需要加密的路径，空数组=全站加密
    const PROTECT_PATHS = ["/stats.html", "/list", "/ip-list", "/save"];
    // =================================

    const url = new URL(request.url);

    // 判断当前路径是否需要验证
    const needAuth = PROTECT_PATHS.length === 0 
      ? true 
      : PROTECT_PATHS.some(p => url.pathname.startsWith(p));

    if (needAuth) {
      const authHeader = request.headers.get("Authorization");
      let valid = false;

      if (authHeader && authHeader.startsWith("Basic ")) {
        try {
          const base64 = authHeader.slice(6);
          const decoded = atob(base64);
          const [user, pass] = decoded.split(":");
          valid = (user === USERNAME && pass === PASSWORD);
        } catch (e) {}
      }

      if (!valid) {
        return withCors(new Response("需要登录才能访问", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="受保护区域"',
            "Content-Type": "text/plain;charset=utf-8"
          }
        }));
      }
    }
    const kv = env.KV;

    // 工具函数：获取北京时间（UTC+8），返回格式化字符串 YYYY-MM-DD HH:mm:ss
    const getBeijingTime = () => {
      const now = new Date();
      // 手动加8小时，转为北京时间
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const year = beijingTime.getUTCFullYear();
      const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(beijingTime.getUTCDate()).padStart(2, '0');
      const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
      const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
      const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // 工具函数：获取北京时间的日期字符串 YYYY-MM-DD（用于当日统计）
    const getBeijingDate = () => {
      const now = new Date();
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const year = beijingTime.getUTCFullYear();
      const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(beijingTime.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 1. 访问统计 + IP记录
    if (url.pathname === "/visit") {
      try {
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        const today = getBeijingDate();
        const totalKey = "visit:total_visit";
        const dayKey = `visit:day:${today}`;
        const ipKey = `visit:ip:${ip}`;

        let total = Number(await kv.get(totalKey)) || 0;
        total += 1;
        await kv.put(totalKey, String(total));

        let dayCnt = Number(await kv.get(dayKey)) || 0;
        dayCnt += 1;
        await kv.put(dayKey, String(dayCnt));

        const ipRecordStr = await kv.get(ipKey);
        let ipRecord;
        try {
          ipRecord = JSON.parse(ipRecordStr);
          if (!ipRecord || typeof ipRecord !== 'object' || !ipRecord.count) {
            throw new Error('格式不匹配');
          }
          ipRecord.lastTime = getBeijingTime();
          ipRecord.count += 1;
        } catch (e) {
          ipRecord = {
            ip: ip,
            firstTime: getBeijingTime(),
            lastTime: getBeijingTime(),
            count: 1
          };
        }
        await kv.put(ipKey, JSON.stringify(ipRecord), { expirationTtl: 86400 * 30 });

        return corsJson({ total, today: dayCnt });
      } catch (e) {
        return corsJson({ total: 0, today: 0, error: e.message }, 500);
      }
    }

    // 2. 保存优质测速记录
    if (url.pathname === "/save") {
      if (request.method !== "POST") {
        return withCors(new Response("Method not allowed", { status: 405 }));
      }
      try {
        const body = await request.json();
        const { name, testUrl, ms, loss } = body;
        const now = Date.now();
        const key = `ping:${now}_${Math.random().toString(36).slice(2)}`;
        const data = JSON.stringify({
          name, testUrl, ms, loss,
          time: getBeijingTime()
        });
        await kv.put(key, data);
        return corsJson({ ok: true });
      } catch (e) {
        return corsJson({ ok: false, error: e.message }, 500);
      }
    }

    // 3. 列出优质测速记录
    if (url.pathname === "/list") {
      try {
        const list = [];
        const res = await kv.list({ prefix: "ping:" });
        for (const item of res.keys) {
          const val = await kv.get(item.name);
          list.push(JSON.parse(val));
        }
        list.sort((a, b) => new Date(b.time) - new Date(a.time));
        return corsJson(list);
      } catch (e) {
        return corsJson([]);
      }
    }

    // 4. 列出所有访客IP记录
    if (url.pathname === "/ip-list") {
      try {
        const list = [];
        const res = await kv.list({ prefix: "visit:ip:" });
        for (const item of res.keys) {
          const val = await kv.get(item.name);
          try {
            list.push(JSON.parse(val));
          } catch (e) {
            continue;
          }
        }
        list.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
        return corsJson(list);
      } catch (e) {
        return corsJson([]);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
