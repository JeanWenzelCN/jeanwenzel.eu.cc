// Cloudflare Workers 主入口文件

import { RouteHandler } from './routes.js';

/**
 * 处理请求
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 * @returns {Promise<Response>} 响应对象
 */
export default {
  async fetch(request, env, ctx) {
    const routeHandler = new RouteHandler(env);
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // 处理根路径
      if (pathname === '/') {
        return await routeHandler.handleRoot(request, env);
      }

      // 处理验证请求
      if (pathname === '/validate') {
        return await routeHandler.handleValidate(request, env);
      }

      // 处理登出请求
      if (pathname === '/logout') {
        return await routeHandler.handleLogout(request, env);
      }

      // 处理管理员后台请求（支持分页）
      if (pathname === '/admin') {
        return await routeHandler.handleAdmin(request, env);
      }

      // 处理添加问题请求
      if (pathname === '/admin/add') {
        return await routeHandler.handleAddQuestion(request, env);
      }

      // 处理删除问题请求
      if (pathname === '/admin/delete') {
        return await routeHandler.handleDeleteQuestion(request, env);
      }

      // 处理管理员登录页面（GET请求）
      if (pathname === '/admin/login') {
        return await routeHandler.handleAdminLogin(request, env);
      }

      // 未找到路由
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('请求处理失败:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
