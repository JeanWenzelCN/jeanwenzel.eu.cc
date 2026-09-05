// 路由处理函数 - 处理各种路由请求

import { createHtmlResponse, createJsonResponse } from './utils.js';
import { HTTP_STATUS } from './config.js';
import { AuthService } from './auth.js';
import { KVStore } from './kv.js';
import { 
  getBaseHtml, 
  getQuestionTemplate, 
  getAdminLoginTemplate,
  getAdminTemplate
} from './templates.js';

/**
 * 路由处理类
 */
export class RouteHandler {
  constructor(env) {
    this.env = env;
    this.authService = new AuthService(env);
    this.kvStore = new KVStore(env);
  }

  /**
   * 处理根路径
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleRoot(request, env) {
    // 检查是否有有效的会话
    const sessionId = this.authService.getSessionId(request);
    
    if (sessionId) {
      // 如果有会话，显示问题页面
      const question = await this.kvStore.getRandomQuestion();
      if (question) {
        const html = getQuestionTemplate(question);
        return createHtmlResponse(HTTP_STATUS.OK, html);
      }
    }
    
    // 如果没有会话或没有问题，显示登录页面
    const html = getBaseHtml('问答验证系统', `
      <div class="container">
        <h1>欢迎来到问答验证系统</h1>
        <p>请输入管理员密码以访问系统：</p>
        <form method="POST" action="/validate">
          <div class="form-group">
            <label for="password">密码:</label>
            <input type="password" id="password" name="password" required>
          </div>
          <button type="submit" class="btn btn-primary">验证</button>
        </form>
      </div>
    `);
    return createHtmlResponse(HTTP_STATUS.OK, html);
  }

  /**
   * 处理验证请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleValidate(request, env) {
    try {
      const formData = await request.formData();
      const password = formData.get('password');
      
      if (this.authService.validateAdminPassword(password)) {
        // 密码正确，创建会话
        const sessionId = this.authService.createSession();
        const html = getBaseHtml('验证成功', `
          <div class="container">
            <h1>验证成功！</h1>
            <p>您已成功登录系统。</p>
            <a href="/" class="btn btn-primary">返回首页</a>
            <a href="/admin" class="btn btn-secondary">进入管理后台</a>
          </div>
        `);
        return createHtmlResponse(HTTP_STATUS.OK, html, sessionId);
      } else {
        // 密码错误，显示错误信息
        const html = getBaseHtml('验证失败', `
          <div class="container">
            <h1>验证失败</h1>
            <p class="error">密码错误，请重新输入。</p>
            <form method="POST" action="/validate">
              <div class="form-group">
                <label for="password">密码:</label>
                <input type="password" id="password" name="password" required>
              </div>
              <button type="submit" class="btn btn-primary">重新验证</button>
            </form>
          </div>
        `);
        return createHtmlResponse(HTTP_STATUS.UNAUTHORIZED, html);
      }
    } catch (error) {
      console.error('验证请求处理失败:', error);
      const html = getBaseHtml('验证失败', `
        <div class="container">
          <h1>验证失败</h1>
          <p>系统发生错误，请稍后重试。</p>
          <a href="/" class="btn btn-primary">返回首页</a>
        </div>
      `);
      return createHtmlResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, html);
    }
  }

  /**
   * 处理登出请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleLogout(request, env) {
    const sessionId = this.authService.getSessionId(request);
    if (sessionId) {
      this.authService.deleteSession(sessionId);
    }
    
    const html = getBaseHtml('登出成功', `
      <div class="container">
        <h1>您已成功登出</h1>
        <p>感谢使用问答验证系统。</p>
        <a href="/" class="btn btn-primary">重新登录</a>
      </div>
    `);
    return createHtmlResponse(HTTP_STATUS.OK, html);
  }

  /**
   * 处理管理员后台请求（支持分页）
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAdmin(request, env) {
    try {
      // 检查是否有有效的会话
      const sessionId = this.authService.getSessionId(request);
      if (!sessionId) {
        return createHtmlResponse(HTTP_STATUS.UNAUTHORIZED, getAdminLoginTemplate());
      }
      
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page')) || 1;
      const pageSize = 10; // 每页显示10个问题

      // 检查管理员密码（POST请求用于登录验证）
      if (request.method === 'POST') {
        const formData = await request.formData();
        const password = formData.get('password');
        
        if (!this.authService.validateAdminPassword(password)) {
          return createHtmlResponse(HTTP_STATUS.UNAUTHORIZED, getAdminLoginTemplate());
        }
        
        // 密码正确，创建会话并重定向到管理后台
        const newSessionId = this.authService.createSession();
        const paginationData = await this.kvStore.getQuestions(page, pageSize);
        const adminHtml = getAdminTemplate(paginationData);
        return createHtmlResponse(HTTP_STATUS.OK, adminHtml, newSessionId);
      }

      // 获取分页问题列表
      const paginationData = await this.kvStore.getQuestions(page, pageSize);
      const adminHtml = getAdminTemplate(paginationData);
      return createHtmlResponse(HTTP_STATUS.OK, adminHtml);
    } catch (error) {
      console.error('管理员请求处理失败:', error);
      const html = getBaseHtml('管理员后台', `
        <div class="container">
          <h1>内部服务器错误</h1>
          <p>系统发生错误，请稍后重试。</p>
          <a href="/" class="btn btn-primary">返回首页</a>
        </div>
      `);
      return createHtmlResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, html);
    }
  }

  /**
   * 处理添加问题请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAddQuestion(request, env) {
    try {
      // 检查是否有有效的会话
      const sessionId = this.authService.getSessionId(request);
      if (!sessionId) {
        return createHtmlResponse(HTTP_STATUS.UNAUTHORIZED, getAdminLoginTemplate());
      }
      
      const formData = await request.formData();
      const question = formData.get('question');
      const answer = formData.get('answer');
      
      if (question && answer) {
        await this.kvStore.saveQuestion(question, answer);
        const html = getBaseHtml('添加成功', `
          <div class="container">
            <h1>问题添加成功</h1>
            <p>新问题已成功添加到系统中。</p>
            <a href="/admin" class="btn btn-primary">返回管理后台</a>
          </div>
        `);
        return createHtmlResponse(HTTP_STATUS.OK, html);
      } else {
        const html = getBaseHtml('添加失败', `
          <div class="container">
            <h1>添加失败</h1>
            <p>请填写完整的问题和答案。</p>
            <a href="/admin" class="btn btn-primary">返回管理后台</a>
          </div>
        `);
        return createHtmlResponse(HTTP_STATUS.BAD_REQUEST, html);
      }
    } catch (error) {
      console.error('添加问题请求处理失败:', error);
      const html = getBaseHtml('添加失败', `
        <div class="container">
          <h1>添加失败</h1>
          <p>系统发生错误，请稍后重试。</p>
          <a href="/admin" class="btn btn-primary">返回管理后台</a>
        </div>
      `);
      return createHtmlResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, html);
    }
  }

  /**
   * 处理删除问题请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleDeleteQuestion(request, env) {
    try {
      // 检查是否有有效的会话
      const sessionId = this.authService.getSessionId(request);
      if (!sessionId) {
        return createHtmlResponse(HTTP_STATUS.UNAUTHORIZED, getAdminLoginTemplate());
      }
      
      const formData = await request.formData();
      const questionId = formData.get('id');
      
      if (questionId) {
        await this.kvStore.deleteQuestion(questionId);
        const html = getBaseHtml('删除成功', `
          <div class="container">
            <h1>问题删除成功</h1>
            <p>问题已成功从系统中删除。</p>
            <a href="/admin" class="btn btn-primary">返回管理后台</a>
          </div>
        `);
        return createHtmlResponse(HTTP_STATUS.OK, html);
      } else {
        const html = getBaseHtml('删除失败', `
          <div class="container">
            <h1>删除失败</h1>
            <p>请选择要删除的问题。</p>
            <a href="/admin" class="btn btn-primary">返回管理后台</a>
          </div>
        `);
        return createHtmlResponse(HTTP_STATUS.BAD_REQUEST, html);
      }
    } catch (error) {
      console.error('删除问题请求处理失败:', error);
      const html = getBaseHtml('删除失败', `
        <div class="container">
          <h1>删除失败</h1>
          <p>系统发生错误，请稍后重试。</p>
          <a href="/admin" class="btn btn-primary">返回管理后台</a>
        </div>
      `);
      return createHtmlResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, html);
    }
  }

  /**
   * 处理管理员登录页面（GET请求）
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAdminLogin(request, env) {
    return createHtmlResponse(HTTP_STATUS.OK, getAdminLoginTemplate());
  }
}
