// HTML模板文件 - 提供可复用的HTML模板

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
    <title>${title}</title>
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
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-right: 10px;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary {
            background-color: #007bff;
            color: white;
        }
        .btn-primary:hover {
            background-color: #0056b3;
        }
        .btn-danger {
            background-color: #dc3545;
            color: white;
        }
        .btn-danger:hover {
            background-color: #c82333;
        }
        .btn-success {
            background-color: #28a745;
            color: white;
        }
        .btn-success:hover {
            background-color: #218838;
        }
        .error {
            color: #dc3545;
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .success {
            color: #155724;
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .form-group input, .form-group textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 3px;
            font-size: 16px;
        }
        .question-list {
            margin-bottom: 20px;
        }
        .question-item {
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
    </div>
    <div class="content">
        ${content}
    </div>
</body>
</html>
  `;
}

/**
 * 获取问题页面模板
 * @param {Array} questions 问题列表
 * @returns {string} HTML内容
 */
export function getQuestionsTemplate(questions) {
  let content = '<p>请回答以下所有问题，全部正确后方可访问内容。</p>';
  
  content += '<form id="qaForm" method="POST" action="/validate">';
  
  for (const question of questions) {
    content += `
      <div class="question-item">
        <h3>问题 ${question.id}: ${question.question}</h3>
        <div class="form-group">
          <input type="text" 
                 name="answer_${question.id}" 
                 placeholder="请输入答案" 
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
 * 获取欢迎页面模板
 * @param {Object} userInfo 用户信息
 * @returns {string} HTML内容
 */
export function getWelcomeTemplate(userInfo) {
  const content = `
    <div class="success">
        <h2>欢迎！</h2>
        <p>您已成功通过验证，可以访问本网站内容。</p>
        <p>验证时间: ${new Date().toLocaleString()}</p>
    </div>
    <a href="/logout" class="btn btn-danger">退出登录</a>
  `;
  
  return getBaseHtml('欢迎', content);
}

/**
 * 获取管理员登录模板
 * @returns {string} HTML内容
 */
export function getAdminLoginTemplate() {
  const content = `
    <form method="POST" action="/admin">
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
 * 获取管理员后台模板
 * @param {Array} questions 问题列表
 * @returns {string} HTML内容
 */
export function getAdminTemplate(questions) {
  let content = '';
  
  // 问题列表
  content += '<div class="question-list">';
  content += '<h2>问题列表</h2>';
  
  for (const question of questions) {
    content += `
      <div class="question-item">
        <h3>问题 ${question.id}: ${question.question}</h3>
        <p><strong>正确答案:</strong> ${question.answer}</p>
        <form method="POST" action="/admin/delete" style="display: inline;">
            <input type="hidden" name="id" value="${question.id}">
            <button type="submit" class="btn btn-danger">删除</button>
        </form>
      </div>
    `;
  }
  
  content += '</div>';
  
  // 添加问题表单
  content += '<div class="form-group">';
  content += '<h2>添加新问题</h2>';
  content += '<form method="POST" action="/admin/add">';
  content += '<div class="form-group">';
  content += '<label for="question">问题内容:</label>';
  content += '<input type="text" id="question" name="question" required>';
  content += '</div>';
  content += '<div class="form-group">';
  content += '<label for="answer">正确答案:</label>';
  content += '<input type="text" id="answer" name="answer" required>';
  content += '</div>';
  content += '<button type="submit" class="btn btn-success">添加问题</button>';
  content += '</form>';
  content += '</div>';
  
  return getBaseHtml('管理员后台', content);
}
