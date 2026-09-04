// 配置文件 - 集中管理常量、KV绑定名、环境变量名等

// KV 命名空间绑定名（需在 wrangler.toml 中配置）
export const KV_USER_STORE = 'USER_STORE';
export const KV_SESSION_STORE = 'SESSION_STORE';

// 环境变量名
export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD';

// Cookie 相关配置
export const COOKIE_NAME = 'qa_session';
export const COOKIE_MAX_AGE = 24 * 60 * 60; // 24小时（秒）

// 验证相关配置
export const MAX_QUESTIONS = 10; // 最大问题数量
export const MAX_ANSWER_LENGTH = 500; // 答案最大长度

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
  INTERNAL_SERVER_ERROR: 500
};

// MIME 类型
export const MIME_TYPES = {
  HTML: 'text/html; charset=utf-8',
  JSON: 'application/json',
  CSS: 'text/css',
  JS: 'application/javascript'
};
