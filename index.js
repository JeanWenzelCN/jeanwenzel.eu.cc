// 主入口文件 - Cloudflare Workers 主程序

import { RouteHandler } from './routes.js';

/**
 * 主处理函数
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 * @param {Object} ctx 执行上下文
 * @returns {Promise<Response>} 响应对象
 */
export default {
  async fetch(request, env, ctx) {
    const routeHandler = new RouteHandler(env);
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // 处理不同的路由
      switch (pathname) {
        case '/':
          return await routeHandler.handleRoot(request, env);
        case '/validate':
          return await routeHandler.handleValidate(request, env);
        case '/logout':
          return await routeHandler.handleLogout(request, env);
        case '/admin':
          return await routeHandler.handleAdmin(request, env);
        case '/admin/add':
          return await handleAddQuestion(request, env);
        case '/admin/delete':
          return await handleDeleteQuestion(request, env);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('请求处理失败:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // 添加问题处理函数
  async handleAddQuestion(request, env) {
    try {
      const formData = await request.formData();
      const question = formData.get('question');
      const answer = formData.get('answer');

      if (!question || !answer) {
        return new Response('问题内容和答案不能为空', { status: 400 });
      }

      const kvStore = new (await import('./kv.js')).KVStore(env);
      const questionId = 'q' + Date.now(); // 生成唯一ID
      
      const questionData = {
        id: questionId,
        question: question.toString(),
        answer: answer.toString(),
        salt: kvStore.generateSalt()
      };

      const success = await kvStore.saveQuestion(questionId, questionData);
      
      if (success) {
        return new Response('问题添加成功', { status: 200 });
      } else {
        return new Response('问题添加失败', { status: 500 });
      }
    } catch (error) {
      console.error('添加问题失败:', error);
      return new Response('服务器内部错误', { status: 500 });
    }
  },

  // 删除问题处理函数
  async handleDeleteQuestion(request, env) {
    try {
      const formData = await request.formData();
      const questionId = formData.get('id');

      if (!questionId) {
        return new Response('问题ID不能为空', { status: 400 });
      }

      const kvStore = new (await import('./kv.js')).KVStore(env);
      const success = await kvStore.deleteQuestion(questionId.toString());
      
      if (success) {
        return new Response('问题删除成功', { status: 200 });
      } else {
        return new Response('问题删除失败', { status: 500 });
      }
    } catch (error) {
      console.error('删除问题失败:', error);
      return new Response('服务器内部错误', { status: 500 });
    }
  }
};
