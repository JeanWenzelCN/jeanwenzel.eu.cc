// HTML模板文件 - 提供可复用的HTML模板
import { escapeHtml } from './utils.js';

/**
 * 获取基础HTML模板
 * @param {string} title 页面标题
 * @param {string} content 页面内容
 * @returns {string} 完整的HTML
 */
export function getBaseHtml(title, content) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #007bff;
        }
        .content {
            margin-bottom: 30px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 8px;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary { background-color: #007bff; color: white; }
        .btn-primary:hover { background-color: #0056b3; }
        .btn-danger { background-color: #dc3545; color: white; }
        .btn-danger:hover { background-color: #c82333; }
        .btn-success { background-color: #28a745; color: white; }
        .btn-success:hover { background-color: #218838; }
        .error {
            color: #dc3545; background-color: #f8d7da;
            border: 1px solid #f5c6cb; padding: 10px;
            border-radius: 5px; margin-bottom: 20px;
        }
        .success {
            color: #155724; background-color: #d4edda;
            border: 1px solid #c3e6cb; padding: 10px;
            border-radius: 5px; margin-bottom: 20px;
        }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group textarea {
            width: 100%; padding: 8px; border: 1px solid #ccc;
            border-radius: 3px; font-size: 16px;
        }
        .question-list { margin-bottom: 20px; }
        .question-item {
            padding: 15px; border: 1px solid #ddd;
            border-radius: 5px; margin-bottom: 10px;
        }
        .pagination {
            display: flex; justify-content: center; align-items: center;
            margin-top: 20px; gap: 5px;
        }
        .pagination button {
            padding: 6px 12px; border: 1px solid #ddd;
            background-color: white; cursor: pointer; border-radius: 3px;
        }
        .pagination button:hover { background-color: #f8f9fa; }
        .pagination button.active { background-color: #007bff; color: white; border-color: #007bff; }
        .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
        .pagination-info { margin: 0 10px; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="content">
        ${content}
    </div>
</body>
</html>
  `;
}

/**
 * 获取问题页面模板（公开展示，questions 只含 id/question，不含答案）
 * @param {Array} questions 问题列表
 * @param {string} [errorMessage] 上一次验证失败时的提示
 * @returns {string} HTML内容
 */
export function getQuestionsTemplate(questions, errorMessage = '') {
  let content = '<p>请回答以下所有问题，全部正确后方可访问内容。</p>';

  if (errorMessage) {
    content += `<div class="error">${escapeHtml(errorMessage)}</div>`;
  }

  if (!questions || questions.length === 0) {
    content += '<p>暂无验证问题，请联系管理员。</p>';
    return getBaseHtml('问答验证系统', content);
  }

  content += '<form id="qaForm" method="POST" action="/validate">';

  for (const question of questions) {
    content += `
      <div class="question-item">
        <h3>问题: ${escapeHtml(question.question)}</h3>
        <div class="form-group">
          <input type="text"
                 name="answer_${escapeHtml(question.id)}"
                 placeholder="请输入答案"
                 maxlength="100"
                 required>
        </div>
      </div>
    `;
  }

  content += '<button type="submit" class="btn btn-primary">提交验证</button>';
  content += '</form>';

  return getBaseHtml('问答验证系统', content);
}

/**
 * 获取欢迎页面模板（仅在会话已通过验证时调用）
 * @param {Object} userInfo 用户信息 { name, email, isAdmin }
 * @returns {string} HTML内容
 */
export function getWelcomeTemplate(userInfo = {}) {
  const name = escapeHtml(userInfo.name || '访客');
  const content = `
    <div class="success">
        <h2>欢迎，${name}！</h2>
        <p>您已成功通过验证，可以访问本网站内容。</p>
    </div>
    ${userInfo.isAdmin ? '<a href="/admin" class="btn btn-primary">管理后台</a>' : ''}
    <a href="/logout" class="btn btn-danger">退出登录</a>
  `;

  return getBaseHtml('欢迎', content);
}

/**
 * 获取管理员登录模板
 * @param {string} [errorMessage]
 * @returns {string} HTML内容
 */
export function getAdminLoginTemplate(errorMessage = '') {
  const content = `
    ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}
    <form method="POST" action="/admin/login">
        <div class="form-group">
            <label for="password">管理员密码:</label>
            <input type="password" id="password" name="password" required>
        </div>
        <button type="submit" class="btn btn-primary">登录</button>
    </form>
  `;

  return getBaseHtml('管理员登录', content);
}

/**
 * 获取管理员后台模板（支持分页）
 * @param {Object} paginationData 分页数据
 * @param {string} csrfToken 当前管理员会话的 CSRF token，写入表单隐藏字段
 * @returns {string} HTML内容
 */
export function getAdminTemplate(paginationData, csrfToken) {
  const { questions, total, totalPages, currentPage } = paginationData;
  const token = escapeHtml(csrfToken);

  let content = '<div class="question-list">';
  content += '<h2>问题列表</h2>';

  if (questions.length === 0) {
    content += '<p>暂无问题数据</p>';
  } else {
    for (const question of questions) {
      content += `
        <div class="question-item">
          <h3>问题: ${escapeHtml(question.question)}</h3>
          <p><em>答案以哈希形式安全存储，后台不回显明文</em></p>
          <form method="POST" action="/admin/delete" style="display: inline;">
              <input type="hidden" name="csrf_token" value="${token}">
              <input type="hidden" name="id" value="${escapeHtml(question.id)}">
              <button type="submit" class="btn btn-danger">删除</button>
          </form>
        </div>
      `;
    }
  }

  content += '</div>';

  if (totalPages > 1) {
    content += '<div class="pagination">';
    content += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="window.location.href='/admin?page=${currentPage - 1}'">上一页</button>`;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        content += `<button class="${i === currentPage ? 'active' : ''}" onclick="window.location.href='/admin?page=${i}'">${i}</button>`;
      } else if (i === currentPage - 3 || i === currentPage + 3) {
        content += '<span>...</span>';
      }
    }

    content += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="window.location.href='/admin?page=${currentPage + 1}'">下一页</button>`;
    content += `<span class="pagination-info">第 ${currentPage} 页，共 ${totalPages} 页，总计 ${total} 个问题</span>`;
    content += '</div>';
  }

  content += '<div class="form-group">';
  content += '<h2>添加新问题</h2>';
  content += '<form method="POST" action="/admin/add">';
  content += `<input type="hidden" name="csrf_token" value="${token}">`;
  content += '<div class="form-group">';
  content += '<label for="question">问题内容:</label>';
  content += '<input type="text" id="question" name="question" maxlength="200" required>';
  content += '</div>';
  content += '<div class="form-group">';
  content += '<label for="answer">正确答案:</label>';
  content += '<input type="text" id="answer" name="answer" maxlength="100" required>';
  content += '</div>';
  content += '<button type="submit" class="btn btn-success">添加问题</button>';
  content += '</form>';
  content += '</div>';

  content += `<form method="POST" action="/admin/logout" style="margin-top:20px;">
      <input type="hidden" name="csrf_token" value="${token}">
      <button type="submit" class="btn btn-danger">退出管理员登录</button>
  </form>`;

  return getBaseHtml('管理员后台', content);
}
