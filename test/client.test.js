import test from "node:test";
import assert from "node:assert/strict";
import {
  articleId,
  getArticle,
  getTeamNews,
  parseArticleHtml,
  parseCommentPayload,
  parseNewsFeed,
  prepareReply,
  teamId,
} from "../lib/client.js";

test("accepts only Dongqiudi team and article URLs", () => {
  assert.equal(teamId("https://pc.dongqiudi.com/team/50000335"), "50000335");
  assert.equal(articleId("https://www.dongqiudi.com/articles/6546419.html"), "6546419");
  assert.throws(() => teamId("https://evil.example/team/50000335"), /仅支持/);
  assert.throws(() => articleId("https://pc.dongqiudi.com/team/50000335"), /链接路径/);
});

test("filters mixed team feed slots and duplicate articles", () => {
  const feed = {
    data: {
      articles: [
        { id: 6546419, title: "泰山备战", show_time: 1792844280 },
        { id: 6546419, title: "泰山备战" },
        { title: "广告" },
        { article: { id: 6546420, title: "赛后采访" } },
      ],
    },
  };
  assert.deepEqual(parseNewsFeed(feed).map((item) => item.id), ["6546419", "6546420"]);
});

test("extracts article body without comments", () => {
  const html = '<article><h1>克雷桑：全力争胜</h1><div class="article-body"><p>山东泰山主场备战下一场比赛。</p><p>球队将全力以赴。</p></div><div class="comments">这里是评论，不应进入正文。</div><div>相关推荐内容</div></article>';
  const article = parseArticleHtml(html, "6546419");
  assert.match(article.content, /全力以赴/);
  assert.doesNotMatch(article.content, /不应进入正文/);
  assert.doesNotMatch(article.content, /相关推荐/);
});

test("normalizes comment objects and preserves reply targets", () => {
  const payload = {
    data: {
      user_list: [{ id: "2", username: "球迷乙" }],
      hot_list: [
        { id: 10, content: "期待主场比赛", user: { username: "球迷甲" }, up: 3 },
        { id: 10, content: "期待主场比赛", user: { username: "球迷甲" } },
      ],
      comment_list: [
        { id: 11, content: "认真防守", user_id: "2", reply_id: 10 },
      ],
    },
  };
  const comments = parseCommentPayload(payload);
  assert.equal(comments.length, 2);
  assert.equal(comments[1].reply_to, "10");
  assert.equal(comments[1].user, "球迷乙");
});

test("falls back to the team page when the feed API fails", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/feeds")) return { ok: false, status: 503 };
    return {
      ok: true,
      text: async () => '<h1 class="tp-hero__name">山东泰山</h1><a class="tp-news-item" href="/articles/6546419.html"><span class="tp-news-item__title">备战新闻</span></a>',
    };
  };
  const result = await getTeamNews(undefined, { fetchImpl });
  assert.equal(result.team_name, "山东泰山");
  assert.equal(result.articles[0].id, "6546419");
  assert.equal(result.source, "team-page");
  assert.equal(calls.length, 2);
});

test("reads article and comments without sending any write request", async () => {
  const methods = [];
  const fetchImpl = async (url, options) => {
    methods.push(options.method ?? "GET");
    if (String(url).includes("/comment?")) {
      return { ok: true, text: async () => JSON.stringify({ data: { comment_list: [{ id: 1, content: "支持球队" }] } }) };
    }
    return { ok: true, text: async () => '<h1>泰山新闻</h1><div class="article-body">球队正在准备下一场比赛。</div>' };
  };
  const article = await getArticle("6546419", { fetchImpl });
  assert.equal(article.comments[0].content, "支持球队");
  assert.deepEqual(methods, ["GET", "GET"]);
});

test("reply tool always returns an unpublished draft", () => {
  const draft = prepareReply({ article: "6546419", replyTo: "支持球队", text: "这场比赛先做好防守，再争取主场三分。" });
  assert.equal(draft.published, false);
  assert.equal(draft.reply_to, "支持球队");
  assert.throws(() => prepareReply({ article: "6546419", text: " " }), /2 至 500/);
});
