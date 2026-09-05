// 路由处理 - 处理所有HTTP请求
import { AuthService } from './auth.js';
import { KVStore } from './kv.js';
import { getBaseHtml, getQuestionsTemplate, getWelcomeTemplate, getAdminLoginTemplate, getAdminTemplate } from './templates.js';
import { createHtmlResponse, createJsonResponse, createRedirectResponse, createErrorResponse } from './utils.js';
import { HTTP_STATUS } from './config.js';

/**
 * 路由处理器类
 */
export class RouteHandler {
  constructor(env) {
    this.authService = new AuthService(env);
    this.kvStore = new KVStore(env);
  }

  /**
   * 处理根路径请求
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleRoot(request, env) {
    try {
      // 检查是否有有效的会话
      const sessionId = this.authService.getSessionIdFromRequest(request);
      if (!sessionId) {
        return createHtmlResponse(getBaseHtml('问答验证系统', getWelcomeTemplate({})));
      }
      
      const session = await this.authService.getSession(sessionId);
      if (!session) {
        return createHtmlResponse(getBaseHtml('问答验证系统', getWelcomeTemplate({})));
      }
      
      return createHtmlResponse(getBaseHtml('问答验证系统', getWelcomeTemplate({
        isLoggedIn: true,
        userInfo: {
          name: session.username || '用户',
          email: session.email || '',
          isAdmin: session.isAdmin || false
        }
      })));
    } catch (error) {
      console.error('处理根路径请求失败:', error);
      return createHtmlResponse(getBaseHtml('问答验证系统', getWelcomeTemplate({})));
    }
  }

  /**
   * 处理问题列表请求
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleQuestions(request, env) {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page')) || 1;
      const pageSize = 10; // 每页显示10个问题
      
      const paginationData = await this.kvStore.getQuestions(page, pageSize);
      
      return createHtmlResponse(getBaseHtml('问题列表', getQuestionsTemplate(paginationData)));
    } catch (error) {
      console.error('处理问题列表请求失败:', error);
      return createErrorResponse('获取问题列表失败', 500);
    }
  }

  /**
   * 处理管理员后台请求（支持分页）
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAdmin(request, env) {
    try {
      // 检查是否有有效的会话
      const sessionId = this.authService.getSessionIdFromRequest(request);
      if (!sessionId) {
        return createHtmlResponse(getAdminLoginTemplate());
      }
      
      const session = await this.authService.getSession(sessionId);
      if (!session || !session.isAdmin) {
        return createHtmlResponse(getAdminLoginTemplate());
      }
      
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page')) || 1;
      const pageSize = 10; // 每页显示10个问题
      
      const paginationData = await this.kvStore.getQuestions(page, pageSize);
      
      return createHtmlResponse(getAdminTemplate(paginationData));
    } catch (error) {
      console.error('处理管理员后台请求失败:', error);
      return createErrorResponse('处理管理员后台请求失败', 500);
    }
  }

  /**
   * 处理管理员登录请求
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAdminLogin(request, env) {
    try {
      const formData = await request.formData();
      const password = formData.get('password');
      
      if (!password) {
        return createHtmlResponse(getAdminLoginTemplate());
      }
      
      const isValidPassword = await this.authService.validateAdminPassword(password);
      if (!isValidPassword) {
        return createHtmlResponse(getAdminLoginTemplate());
      }
      
      const sessionId = this.authService.generateSessionId();
      await this.authService.createSession(sessionId, { 
        isAdmin: true, 
        username: '管理员',
        createdAt: Date.now() 
      });
      
      const response = createRedirectResponse('/admin');
      return this.authService.setSessionCookie(response, sessionId);
    } catch (error) {
      console.error('处理管理员登录请求失败:', error);
      return createErrorResponse('管理员登录失败', 500);
    }
  }

  /**
   * 处理管理员登出请求
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAdminLogout(request, env) {
    try {
      const sessionId = this.authService.getSessionIdFromRequest(request);
      if (sessionId) {
        await this.authService.deleteSession(sessionId);
      }
      
      const response = createRedirectResponse('/admin');
      return this.authService.clearSessionCookie(response);
    } catch (error) {
      console.error('处理管理员登出请求失败:', error);
      return createErrorResponse('管理员登出失败', 500);
    }
  }

  /**
   * 处理API请求
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleApi(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace('/api/', '');
      
      switch (path) {
        case 'questions':
          return await this.handleApiQuestions(request, env);
        case 'add-question':
          return await this.handleApiAddQuestion(request, env);
        case 'delete-question':
          return await this.handleApiDeleteQuestion(request, env);
        default:
          return createErrorResponse('不支持的API端点', 404);
      }
    } catch (error) {
      console.error('处理API请求失败:', error);
      return createErrorResponse('处理API请求失败', 500);
    }
  }

  /**
   * 处理API问题列表请求
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleApiQuestions(request, env) {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page')) || 1;
      const pageSize = parseInt(url.searchParams.get('pageSize')) || 10;
      
      const paginationData = await this.kvStore.getQuestions(page, pageSize);
      return createJsonResponse(paginationData);
    } catch (error) {
      console.error('处理API问题列表请求失败:', error);
      return createErrorResponse('获取问题列表失败', 500);
    }
  }

  /**
   * 处理API添加问题请求
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleApiAddQuestion(request, env) {
    try {
      const formData = await request.formData();
      const question = formData.get('question');
      const answer = formData.get('answer');
      
      if (!question || !answer) {
        return createErrorResponse('问题答案不能为空', 400);
      }
      
      await this.kvStore.addQuestion(question, answer);
      return createJsonResponse({ success: true });
    } catch (error) {
      console.error('处理API添加问题请求失败:', error);
      return createErrorResponse('添加问题失败', 500);
    }
  }

  /**
   * 处理API删除问题请求
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleApiDeleteQuestion(request, env) {
    try {
      const formData = await request.formData();
      const questionId = formData.get('questionId');
      
      if (!questionId) {
        return createErrorResponse('问题ID不能为空', 400);
      }
      
      await this.kvStore.deleteQuestion(questionId);
      return createJsonResponse({ success: true });
    } catch (error) {
      console.error('处理API删除问题请求失败:', error);
      return createErrorResponse('删除问题失败', 500);
    }
  }
}
