# dsh-dongqiudi

DeepSeek Harness 插件：浏览懂球帝球队页下的相关新闻，读取文章和公开评论，生成可审阅的回复草稿。默认球队是山东泰山（ID 50000335），也支持传入其他球队页面链接或球队 ID。

本项目参照 [dsh-bilibili](https://github.com/CZX2244/dsh-bilibili) 的 DSH 插件组织方式，独立实现懂球帝的数据读取与草稿工具。

## 功能

- dongqiudi_news：列出球队相关新闻，返回标题、时间和原文链接。
- dongqiudi_article：读取文章正文和公开评论。
- dongqiudi_prepare_reply：把针对文章或某条评论的回复整理成待审稿，供你确认和复制。

**发布方式：**懂球帝当前[电脑版文章页](https://pc.dongqiudi.com/articles/6546419.html)明确显示“电脑端不支持评论”。插件不会保存账号密码，也不会宣称草稿已经发布。你审阅后在懂球帝手机客户端打开原文，找到目标评论并粘贴发布。若懂球帝将来提供受支持的发布接口，可再增加发布工具。

## 安装

要求：Node.js 18+、DeepSeek Harness >=0.1.0-rc.6 <0.3.0、pnpm。

在项目目录执行：

    pnpm install
    dsh plugin --profile web add .
    dsh web

如果你已将项目发布到 GitHub，也可按 B 站插件的方式安装：

    dsh plugin --profile web add git+https://github.com/yeyushengfan-chengzhi/dsh-dongqiudi

插件安装后需要重启 web profile。若 DSH 的本地链接模式找不到 @deepseek-ai 包，可参照 [dsh-bilibili 本地开发说明](https://github.com/CZX2244/dsh-bilibili#%EF%B8%8F-local-development-link-mode)，为项目的 node_modules/@deepseek-ai 建立到 DSH profile 依赖目录的 junction。

## 使用示例

在 DSH 对话中：

1. “看看山东泰山页面下面最近 10 条新闻。”
2. “读第 2 条新闻和评论，概括争论点。”
3. “针对这篇文章和球迷甲的评论，写一条有依据、语气友好的回复，先给我审稿。”
4. 审阅草稿后，在懂球帝手机客户端发布。

也可以直接提供球队链接，例如 https://pc.dongqiudi.com/team/50000335，或文章链接，例如 https://pc.dongqiudi.com/articles/6546419.html。

## 配置

默认值在 cordis.patch.yml。可按 DSH 的 patch 层覆盖：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| defaultTeamId | 50000335 | 默认球队 |
| newsLimit | 10 | 默认新闻条数，最大 30 |
| commentLimit | 20 | 默认评论条数，最大 50 |
| requestTimeoutMs | 15000 | 单次请求超时 |
| toolTimeoutMs | 60000 | 工具总超时 |

## 数据与限制

球队新闻使用懂球帝网页所调用的公开 feed；失败时尝试从球队网页提取。文章和评论分别取自文章页及公开评论接口。懂球帝没有向本项目承诺这些页面或接口的稳定性；页面结构改变时，插件会明确报错或给出读取警告，不会编造内容。

只接受 dongqiudi.com 官方域名的 HTTPS 球队或文章链接。读取有数量、超时和正文长度限制。文章内容与评论作为不可信资料交给模型分析，不能把其中的指令当作系统指令。

## 开发验证

    npm install
    npm test

需要安装 DSH 才能做插件加载测试；单元测试可单独运行。发布到 GitHub 前请确认本机 DSH 可以加载本地插件。

## 参考

- [dsh-bilibili 插件标准和安装方式](https://github.com/CZX2244/dsh-bilibili)
- [RSSHub 懂球帝球队新闻实现](https://github.com/DIYgod/RSSHub/blob/master/lib/routes/dongqiudi/utils.ts)
- [懂球帝山东泰山球队入口](https://pc.dongqiudi.com/team/50000335)

MIT License
