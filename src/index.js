// Cloudflare Workers 主入口文件

import { RouteHandler } from './routes.js';

export default {
  async fetch(request, env, ctx) {
    const routeHandler = new RouteHandler(env);
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    try {
      if (pathname === '/' && method === 'GET') {
        return await routeHandler.handleRoot(request);
      }

      if (pathname === '/question' && method === 'GET') {
        return await routeHandler.handleQuestionPage(request);
      }

      if (pathname === '/question/answer' && method === 'POST') {
        return await routeHandler.handleQuestionAnswer(request);
      }

      if (pathname === '/logout' && (method === 'GET' || method === 'POST')) {
        return await routeHandler.handleLogout(request);
      }

      if (pathname === '/admin' && method === 'GET') {
        return await routeHandler.handleAdmin(request);
      }

      if (pathname === '/admin/login' && method === 'GET') {
        return await routeHandler.handleAdminLoginPage();
      }

      if (pathname === '/admin/login' && method === 'POST') {
        return await routeHandler.handleAdminLogin(request);
      }

      if (pathname === '/admin/logout' && method === 'POST') {
        return await routeHandler.handleLogout(request);
      }

      if (pathname === '/admin/add' && method === 'POST') {
        return await routeHandler.handleAddQuestion(request);
      }

      if (pathname === '/admin/delete' && method === 'POST') {
        return await routeHandler.handleDeleteQuestion(request);
      }

      if (pathname === '/admin/settings' && method === 'POST') {
        return await routeHandler.handleAdminSettings(request);
      }

      if (pathname === '/admin/message/delete' && method === 'POST') {
        return await routeHandler.handleDeleteMessage(request);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('请求处理失败:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
