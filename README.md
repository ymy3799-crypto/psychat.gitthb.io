# Frontend Prototype

这是一个独立的静态前端原型，包含：

- 登录 / 注册页面：`index.html`
- 聊天主页：`chat.html`
- 样式：`styles.css`
- 交互脚本：`auth.js`、`chat.js`

## 说明

- 当前版本不连接你之前的 FastAPI 后端。
- 登录 / 注册为前端演示逻辑，账户信息保存在浏览器 `localStorage` 中。
- 聊天消息不会预设任何 AI 回复。
- 如需真正调用大模型，请在 `chat.js` 中填写：

```js
const APP_CONFIG = {
  chatApiUrl: "你的后端聊天接口地址",
};
```

## 本地打开

你可以直接双击 `index.html` 打开，也可以使用任意静态服务器进行预览。
