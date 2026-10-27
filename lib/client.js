import { load } from "cheerio";

const API_ORIGIN = "https://api.dongqiudi.com";
const PC_ORIGIN = "https://pc.dongqiudi.com";
const WEB_ORIGIN = "https://www.dongqiudi.com";

function clamp(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function extractId(value, kind) {
  const input = String(value ?? "").trim();
  if (/^\d{5,12}$/.test(input)) return input;
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("请提供懂球帝" + (kind === "team" ? "球队" : "文章") + "链接或数字 ID");
  }
  if (url.protocol !== "https:" || !["pc.dongqiudi.com", "www.dongqiudi.com", "dongqiudi.com", "m.dongqiudi.com"].includes(url.hostname)) {
    throw new Error("仅支持 dongqiudi.com 的 HTTPS 链接");
  }
  const pattern = kind === "team" ? /^\/team\/(\d{5,12})(?:\.html)?\/?$/ : /^\/articles?\/(\d{5,12})(?:\.html)?\/?$/;
  const match = url.pathname.match(pattern);
  if (!match) throw new Error("链接路径应为 /" + (kind === "team" ? "team" : "articles") + "/数字ID");
  return match[1];
}

export function teamId(value, fallback = "50000335") {
  return extractId(value || fallback, "team");
}

export function articleId(value) {
  return extractId(value, "article");
}

export function articleUrl(id) {
  return PC_ORIGIN + "/articles/" + articleId(id) + ".html";
}

export function teamUrl(id) {
  return PC_ORIGIN + "/team/" + teamId(id);
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function pickArticle(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? raw.article_id ?? "").trim();
  if (!/^\d{5,12}$/.test(id)) return null;
  return {
    id,
    title: clean(raw.title),
    url: articleUrl(id),
    published_at: raw.show_time ?? raw.published_at ?? raw.created_at ?? null,
    category: clean(raw.category),
    comment_count: Number(raw.comment_total ?? raw.comment_count ?? 0) || 0,
  };
}

export function parseNewsFeed(payload, limit = 10) {
  const data = payload?.data ?? payload;
  const list = data?.articles ?? data?.feeds ?? [];
  if (!Array.isArray(list)) throw new Error("球队新闻接口返回结构已变化");
  const seen = new Set();
  return list.map((item) => pickArticle(item?.article ?? item)).filter((item) => {
    if (!item || !item.title || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, clamp(limit, 10, 1, 30));
}

export function parseTeamHtml(html, limit = 10) {
  const $ = load(html);
  const seen = new Set();
  const articles = [];
  $('a[href*="/articles/"], a[href*="/article/"]').each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href") ?? "";
    const match = href.match(/\/articles?\/(\d{5,12})/);
    if (!match || seen.has(match[1])) return;
    const title = clean(anchor.find(".tp-news-item__title").first().text() || anchor.attr("title") || anchor.text());
    if (!title) return;
    seen.add(match[1]);
    articles.push({
      id: match[1],
      title,
      url: articleUrl(match[1]),
      published_at: clean(anchor.find(".tp-news-item__time").first().text()) || null,
      category: clean(anchor.find(".tp-news-item__tag").first().text()),
      comment_count: 0,
    });
  });
  return {
    team_name: clean($("h1.tp-hero__name, h1").first().text()),
    articles: articles.slice(0, clamp(limit, 10, 1, 30)),
  };
}

export function parseArticleHtml(html, id) {
  const $ = load(html);
  $("script, style, nav, footer, aside, .comment-list, .comments, .recommend, .related-news").remove();
  const title = clean($("h1").first().text() || $('meta[property="og:title"]').attr("content"));
  const selectors = [
    ".article-body",
    "[itemprop='articleBody']",
    ".article-content",
    ".news-content",
    "article",
  ];
  let body = "";
  for (const selector of selectors) {
    const candidate = $(selector).first();
    const text = clean(candidate.text());
    if (text.length >= 10) {
      body = text;
      break;
    }
  }
  const author = clean($(".article-head__author-name, .article-author, [rel='author']").first().text());
  const publishedAt = clean($("time").first().attr("datetime") || $("time").first().text() || $('meta[property="article:published_time"]').attr("content"));
  return {
    id: articleId(id),
    url: articleUrl(id),
    title,
    author,
    published_at: publishedAt || null,
    content: body.slice(0, 18000),
    truncated: body.length > 18000,
  };
}

function normalizeComment(raw, users) {
  if (!raw || typeof raw !== "object") return null;
  const text = clean(raw.content ?? raw.body ?? raw.comment ?? raw.text);
  if (!text) return null;
  const user = raw.user ?? raw.author ?? users.get(String(raw.user_id ?? "")) ?? {};
  return {
    id: String(raw.id ?? raw.comment_id ?? ""),
    user: clean(user.username ?? user.name ?? raw.username),
    content: text.slice(0, 1500),
    likes: Number(raw.up ?? raw.up_count ?? raw.likes ?? 0) || 0,
    created_at: raw.created_at ?? raw.created_time ?? raw.time ?? null,
    reply_to: String(raw.reply_id ?? raw.parent_id ?? ""),
  };
}

export function parseCommentPayload(payload, limit = 20) {
  const data = payload?.data ?? payload;
  const users = new Map((Array.isArray(data?.user_list) ? data.user_list : []).map((user) => [String(user.id), user]));
  const buckets = [data?.hot, data?.hot_list, data?.recommend_list, data?.comment_list, data?.comments, data?.list, data?.replies];
  const raw = buckets.flatMap((part) => Array.isArray(part) ? part : []);
  const seen = new Set();
  return raw.map((comment) => normalizeComment(comment, users)).filter((comment) => {
    if (!comment) return false;
    const key = comment.id || comment.user + "\0" + comment.content;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, clamp(limit, 20, 1, 50));
}

export async function fetchText(url, { signal, timeoutMs = 15000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("请求超时")), clamp(timeoutMs, 15000, 1000, 60000));
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; dsh-dongqiudi/0.1)",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        referer: WEB_ORIGIN + "/",
      },
    });
    if (!response.ok) throw new Error("懂球帝请求失败：HTTP " + response.status);
    return await response.text();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function fetchJson(url, options) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("懂球帝接口未返回 JSON，可能触发访问限制");
  }
}

export async function getTeamNews(input, options = {}) {
  const id = teamId(input, options.defaultTeamId);
  const limit = clamp(options.limit, 10, 1, 30);
  const feed = new URL(API_ORIGIN + "/v3/archive/app/channel/feeds");
  feed.searchParams.set("id", id);
  feed.searchParams.set("type", "team");
  feed.searchParams.set("size", String(Math.max(20, limit * 3)));
  feed.searchParams.set("platform", "web");
  feed.searchParams.set("version", "");
  const result = { team_id: id, team_url: teamUrl(id), team_name: id === "50000335" ? "山东泰山" : "", articles: [], source: "", warnings: [] };
  try {
    result.articles = parseNewsFeed(await fetchJson(feed, options), limit);
    result.source = "feed-api";
  } catch (error) {
    result.warnings.push("球队新闻接口不可用：" + error.message);
  }
  if (!result.articles.length) {
    try {
      const parsed = parseTeamHtml(await fetchText(teamUrl(id), options), limit);
      result.team_name = parsed.team_name || result.team_name;
      result.articles = parsed.articles;
      result.source = "team-page";
    } catch (error) {
      result.warnings.push("球队网页不可用：" + error.message);
    }
  }
  if (!result.articles.length) throw new Error(result.warnings.join("；") || "没有找到球队新闻");
  return result;
}

export async function getArticle(input, options = {}) {
  const id = articleId(input);
  const article = parseArticleHtml(await fetchText(articleUrl(id), options), id);
  if (!article.title || !article.content) throw new Error("文章页面结构已变化，无法可靠提取正文：" + article.url);
  const commentLimit = clamp(options.commentLimit, 20, 0, 50);
  article.comments = [];
  article.warnings = [];
  if (commentLimit > 0) {
    const url = API_ORIGIN + "/v2/article/" + id + "/comment?sort=down&version=600";
    try {
      article.comments = parseCommentPayload(await fetchJson(url, options), commentLimit);
      if (!article.comments.length) article.warnings.push("评论接口没有返回可识别的评论；请在手机客户端核对");
    } catch (error) {
      article.warnings.push("评论读取失败：" + error.message);
    }
  }
  return article;
}

export function prepareReply({ article, replyTo = "", text }) {
  const id = articleId(article);
  const body = clean(text);
  if (body.length < 2 || body.length > 500) throw new Error("回复正文应为 2 至 500 字");
  const target = clean(replyTo);
  if (target.length > 1500) throw new Error("目标评论过长");
  return {
    status: "draft",
    article_id: id,
    article_url: articleUrl(id),
    reply_to: target || null,
    text: body,
    published: false,
    next_step: "请审阅文字；确认后在懂球帝手机客户端打开文章，找到目标评论并粘贴发布。电脑端不支持评论。",
  };
}
