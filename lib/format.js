function line(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function formatNews(value) {
  return [
    "球队：" + (value.team_name || value.team_id),
    "球队页：" + value.team_url,
    "数据来源：" + value.source,
    "",
    ...value.articles.map((item, index) =>
      (index + 1) + ". " + item.title + "\n" +
      "   " + item.url + (item.published_at ? " · " + item.published_at : "")
    ),
    ...(value.warnings.length ? ["", "提示：" + value.warnings.join("；")] : []),
  ].join("\n");
}

export function formatArticle(value) {
  const comments = value.comments.length
    ? value.comments.map((comment, index) =>
      (index + 1) + ". " + (comment.user || "球迷") +
      (comment.id ? " [评论ID " + comment.id + "]" : "") +
      ": " + comment.content
    )
    : ["暂无可识别评论"];
  return [
    "标题：" + value.title,
    "链接：" + value.url,
    value.author ? "作者：" + value.author : "",
    value.published_at ? "时间：" + value.published_at : "",
    "",
    "正文：",
    value.content,
    value.truncated ? "（正文已截断）" : "",
    "",
    "评论：",
    ...comments,
    ...(value.warnings.length ? ["", "提示：" + value.warnings.join("；")] : []),
  ].filter((part) => part !== "").join("\n");
}

export function formatDraft(value) {
  return [
    "待审回复（尚未发布）",
    "文章：" + value.article_url,
    value.reply_to ? "回复对象：" + line(value.reply_to) : "回复位置：文章评论区",
    "",
    value.text,
    "",
    value.next_step,
  ].join("\n");
}
