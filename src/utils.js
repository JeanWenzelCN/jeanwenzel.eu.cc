// 工具函数 - 提供通用功能支持

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 生成密码学安全的随机字符串（使用 Web Crypto，避免 Math.random 可预测的问题）
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
function generateRandomString(length = 32) {
    const charsLength = CHARS.length;
    // 拒绝采样，避免取模导致的分布偏差
    const maxValid = Math.floor(256 / charsLength) * charsLength;
    let result = '';
    const buffer = new Uint8Array(1);
    while (result.length < length) {
        crypto.getRandomValues(buffer);
        if (buffer[0] < maxValid) {
            result += CHARS.charAt(buffer[0] % charsLength);
        }
    }
    return result;
}

/**
 * 生成会话ID（64字符，密码学安全随机）
 * @returns {string} 会话ID
 */
function generateSessionId() {
    return generateRandomString(64);
}

/**
 * 对文本+盐值做 SHA-256 哈希（Cloudflare Workers 全局 Web Crypto API，无需任何 import）
 * @param {string} text - 原始文本
 * @param {string} salt - 盐值
 * @returns {Promise<string>} 十六进制哈希字符串
 */
async function hashWithSalt(text, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${text}:${salt}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * 恒定时间字符串比较，防止基于响应耗时的侧信道攻击
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/**
 * HTML 转义，防止存储型/反射型 XSS
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 从Cookie中获取值
 * @param {string} cookie - Cookie字符串
 * @param {string} name - Cookie名称
 * @returns {string|null} Cookie值
 */
function getCookieValue(cookie, name) {
    if (!cookie) return null;
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * 设置Cookie
 * @param {string} name - Cookie名称
 * @param {string} value - Cookie值
 * @param {Object} options - Cookie选项
 * @returns {string} Cookie字符串
 */
function setCookie(name, value, options = {}) {
    const defaultOptions = {
        path: '/',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1天
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
    };

    const finalOptions = { ...defaultOptions, ...options };

    let cookieString = `${name}=${encodeURIComponent(value)}`;

    if (finalOptions.expires) {
        cookieString += `; Expires=${finalOptions.expires.toUTCString()}`;
    }

    if (finalOptions.path) {
        cookieString += `; Path=${finalOptions.path}`;
    }

    if (finalOptions.httpOnly) {
        cookieString += '; HttpOnly';
    }

    if (finalOptions.secure) {
        cookieString += '; Secure';
    }

    if (finalOptions.sameSite) {
        cookieString += `; SameSite=${finalOptions.sameSite}`;
    }

    return cookieString;
}

/**
 * 清除Cookie
 * @param {string} name - Cookie名称
 * @param {string} path - Cookie路径
 * @returns {string} 清除Cookie的字符串
 */
function clearCookie(name, path = '/') {
    return `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`;
}

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
};

/**
 * 创建HTML响应
 * @param {string} html - HTML内容
 * @returns {Response} HTML响应对象
 */
function createHtmlResponse(html) {
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...SECURITY_HEADERS
        }
    });
}

/**
 * 创建JSON响应
 * @param {Object} data - JSON数据
 * @returns {Response} JSON响应对象
 */
function createJsonResponse(data) {
    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...SECURITY_HEADERS
        }
    });
}

/**
 * 创建重定向响应
 * @param {string} url - 目标URL
 * @returns {Response} 重定向响应对象
 */
function createRedirectResponse(url) {
    // 不用 Response.redirect()：它在 Workers 运行时里要求绝对 URL，
    // 传相对路径（如 "/admin"）会抛 TypeError。直接手写 Location 头，
    // 相对路径在 HTTP 规范里是合法的，浏览器会自行解析。
    return new Response(null, {
        status: 302,
        headers: { Location: url }
    });
}

/**
 * 创建错误响应
 * @param {string} message - 错误消息
 * @param {number} statusCode - HTTP状态码
 * @returns {Response} 错误响应对象
 */
function createErrorResponse(message, statusCode = 400) {
    return new Response(JSON.stringify({ error: message }), {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...SECURITY_HEADERS
        }
    });
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 验证URL格式
 * @param {string} url - URL地址
 * @returns {boolean} 是否有效
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取当前时间戳
 * @returns {number} Unix时间戳
 */
function getTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * 格式化日期时间
 * @param {number} timestamp - 时间戳
 * @param {string} format - 格式 (YYYY-MM-DD HH:mm:ss)
 * @returns {string} 格式化后的日期时间
 */
function formatDateTime(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

export {
    generateRandomString,
    generateSessionId,
    hashWithSalt,
    timingSafeEqual,
    escapeHtml,
    getCookieValue,
    setCookie,
    clearCookie,
    createHtmlResponse,
    createJsonResponse,
    createRedirectResponse,
    createErrorResponse,
    isValidEmail,
    isValidUrl,
    getTimestamp,
    formatDateTime
};
