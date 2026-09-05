// 配置文件 - 集中管理常量、KV绑定名、环境变量名等

// KV 命名空间绑定名（需在 wrangler.toml 中配置）
export const KV_SESSION_STORE = 'SESSION_STORE';
export const KV_QUESTION_STORE = 'KV';

// 环境变量名
export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD';

// Cookie 相关配置
export const COOKIE_NAME = 'sessionId';
export const COOKIE_MAX_AGE = 24 * 60 * 60; // 24小时（秒）

// 会话超时时间（毫秒）
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30分钟

// 验证相关配置
export const MAX_QUESTIONS = 10; // 最大问题数量
export const MAX_QUESTION_LENGTH = 200; // 问题最大长度
export const MAX_ANSWER_LENGTH = 100; // 答案最大长度

// 登录 / 验证 暴力破解防护
export const RATE_LIMIT_MAX_ATTEMPTS = 5; // 窗口期内允许的最大失败次数
export const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15分钟窗口

// 页面路径
export const PATH_ROOT = '/';
export const PATH_ADMIN = '/admin';
export const PATH_LOGOUT = '/logout';
export const PATH_VALIDATE = '/validate';

// HTTP 状态码
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
};

// MIME 类型
export const MIME_TYPES = {
  HTML: 'text/html; charset=utf-8',
  JSON: 'application/json',
  CSS: 'text/css',
  JS: 'application/javascript'
};
