import fs from "node:fs";
import { URL } from "node:url";

function loadDotEnv(filePath = ".env") {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const ENV = {
  wechatAppId: process.env.WECHAT_APP_ID || "",
  wechatAppSecret: process.env.WECHAT_APP_SECRET || "",
  wechatToUserOpenId: process.env.WECHAT_TO_USER_OPENID || "",
  wechatTemplateId: process.env.WECHAT_TEMPLATE_ID || "",
  loveStartDate: process.env.LOVE_START_DATE || "",
  birthday: process.env.BIRTHDAY || "",
  targetCity: process.env.TARGET_CITY || "天津",
  aliyunWeatherUrl:
    process.env.ALIYUN_WEATHER_URL ||
    "https://jisutqybmf.market.alicloudapi.com/weather/query",
  aliyunAppCode: process.env.ALIYUN_APPCODE || "",
  dailyPushHour: Number(process.env.DAILY_PUSH_HOUR ?? 8),
  dailyPushMinute: Number(process.env.DAILY_PUSH_MINUTE ?? 0),
  enableSchedule: String(process.env.ENABLE_SCHEDULE || "true") === "true",
  sendOnce: String(process.env.SEND_ONCE || process.env.GITHUB_ACTIONS || "") === "true"
};

function mustEnv() {
  const required = [
    ["WECHAT_APP_ID", ENV.wechatAppId],
    ["WECHAT_APP_SECRET", ENV.wechatAppSecret],
    ["WECHAT_TO_USER_OPENID", ENV.wechatToUserOpenId],
    ["WECHAT_TEMPLATE_ID", ENV.wechatTemplateId],
    ["LOVE_START_DATE", ENV.loveStartDate],
    ["BIRTHDAY", ENV.birthday],
    ["ALIYUN_APPCODE", ENV.aliyunAppCode]
  ];

  const missed = required.filter((x) => !x[1]).map((x) => x[0]);
  if (missed.length) {
    throw new Error(`Missing environment variables: ${missed.join(", ")}`);
  }
}

function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function httpJSON(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  const data = safeJSONParse(text);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  if (!data) {
    throw new Error(`Non-JSON response from ${url}`);
  }
  return data;
}

function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtTime(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function fmtWeekday(date) {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return weekdays[date.getDay()];
}

function parseDateYMD(input) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) {
    throw new Error(`Invalid date format, expected YYYY-MM-DD: ${input}`);
  }
  const y = Number(m[1]);
  const mon = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mon - 1, d);
}

function parseBirthdayMMDD(input) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(input.trim());
  if (!m) {
    throw new Error(`Invalid birthday format, expected MM-DD: ${input}`);
  }
  const month = Number(m[1]);
  const day = Number(m[2]);
  return { month, day };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(fromDate, toDate) {
  const ms = startOfDay(toDate).getTime() - startOfDay(fromDate).getTime();
  return Math.floor(ms / 86400000);
}

function daysInLove(loveStartDate) {
  const start = parseDateYMD(loveStartDate);
  const today = new Date();
  return diffDays(start, today) + 1;
}

function daysToNextBirthday(birthday) {
  const { month, day } = parseBirthdayMMDD(birthday);
  const now = new Date();
  const thisYearBirthday = new Date(now.getFullYear(), month - 1, day);
  const nextBirthday =
    startOfDay(now).getTime() <= startOfDay(thisYearBirthday).getTime()
      ? thisYearBirthday
      : new Date(now.getFullYear() + 1, month - 1, day);

  return diffDays(now, nextBirthday);
}

function pick(obj, paths) {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, key)) {
        cur = cur[key];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined && cur !== null && cur !== "") {
      return cur;
    }
  }
  return "";
}

async function getWeChatAccessToken() {
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", ENV.wechatAppId);
  url.searchParams.set("secret", ENV.wechatAppSecret);

  const data = await httpJSON(url.toString());
  if (data.errcode) {
    throw new Error(
      `WeChat token error: ${data.errcode} ${data.errmsg || ""}`.trim()
    );
  }
  if (!data.access_token) {
    throw new Error(`WeChat token missing: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function getWeatherOfTianjin() {
  const url = new URL(ENV.aliyunWeatherUrl);
  url.searchParams.set("city", ENV.targetCity);

  const data = await httpJSON(url.toString(), {
    headers: {
      Authorization: `APPCODE ${ENV.aliyunAppCode}`
    }
  });

  const weather = pick(data, [
    ["result", "weather"],
    ["result", "weatherDesc"],
    ["showapi_res_body", "now", "weather"],
    ["data", "weather"]
  ]);
  const temp = pick(data, [
    ["result", "temp"],
    ["showapi_res_body", "now", "temperature"],
    ["data", "temp"]
  ]);
  const high = pick(data, [
    ["result", "temphigh"],
    ["showapi_res_body", "f1", "day_air_temperature"],
    ["data", "high"]
  ]);
  const low = pick(data, [
    ["result", "templow"],
    ["showapi_res_body", "f1", "night_air_temperature"],
    ["data", "low"]
  ]);
  const humidity = pick(data, [
    ["result", "humidity"],
    ["showapi_res_body", "now", "sd"],
    ["data", "humidity"]
  ]);

  return {
    city: ENV.targetCity,
    weather: String(weather || "未知"),
    temp: String(temp || "-"),
    high: String(high || "-"),
    low: String(low || "-"),
    humidity: String(humidity || "-")
  };
}

async function getDailyQuote() {
  const data = await httpJSON("https://open.iciba.com/dsapi/");
  return {
    en: String(data.content || ""),
    zh: String(data.note || "")
  };
}

function getWeatherGreeting(weather) {
  const text = `${weather.weather} ${weather.temp} ${weather.high} ${weather.low}`;
  const temp = Number(weather.temp);
  const high = Number(weather.high);
  const low = Number(weather.low);

  if (/雨|雪|雷|阵雨|暴雨|小雨|中雨|大雨/.test(text)) {
    return "出门记得带伞，路上慢一点。";
  }
  if (/雾|霾|沙尘/.test(text)) {
    return "空气不太舒服，出门可以戴好口罩。";
  }
  if (Number.isFinite(high) && high >= 30) {
    return "天气有点热，记得多喝水，别晒太久。";
  }
  if (Number.isFinite(low) && low <= 5) {
    return "天气偏冷，出门多穿一点，别着凉。";
  }
  if (Number.isFinite(temp) && temp >= 28) {
    return "今天温度不低，记得补水。";
  }
  if (Number.isFinite(temp) && temp <= 8) {
    return "今天有点冷，抱紧小外套。";
  }
  if (/晴/.test(text)) {
    return "天气不错，愿你今天也有亮亮的心情。";
  }
  return "天气变化要留意，照顾好自己。";
}

function buildMessage({ weather, quote }) {
  const now = new Date();
  const today = `${fmtDate(now)} ${fmtTime(now)}`;
  const weekday = fmtWeekday(now);
  const weatherGreeting = getWeatherGreeting(weather);
  const inLove = daysInLove(ENV.loveStartDate);
  const birthdayIn = daysToNextBirthday(ENV.birthday);

  const lines = [
    `🌅 早安，亲爱的小姜宝宝！`,
    `📅 今天是 ${today} ${weekday}`,
    `🌤️ ${weather.city}天气：${weather.weather}℃`,
    `当前 ${weather.temp}℃，最高 ${weather.high}℃，最低 ${weather.low}℃，湿度 ${weather.humidity}。`,
    `${weatherGreeting}`,
    "",
    `💞 今天是我们相爱第 ${inLove} 天`,
    `🎂 距离你的生日还有 ${birthdayIn} 天`,
    "",
    `💌 ${quote.zh}`,
    `🌹 ${quote.en}`
  ];

  return {
    plainText: lines.join("\n"),
    fields: {
      date: `${today} ${weekday}`,
      weatherCity: weather.city,
      weatherText: weather.weather,
      weatherTemp: weather.temp,
      weatherHigh: weather.high,
      weatherLow: weather.low,
      weatherHumidity: weather.humidity,
      weatherGreeting,
      loveDays: String(inLove),
      birthdayDays: String(birthdayIn),
      quoteEn: quote.en,
      quoteZh: quote.zh
    }
  };
}

async function sendTemplateMessage(accessToken, message) {
  const url = new URL(
    "https://api.weixin.qq.com/cgi-bin/message/template/send"
  );
  url.searchParams.set("access_token", accessToken);

  const body = {
    touser: ENV.wechatToUserOpenId,
    template_id: ENV.wechatTemplateId,
    data: {
      date: { value: message.fields.date, color: "#173177" },
      weatherCity: { value: message.fields.weatherCity, color: "#1890ff" },
      weatherText: { value: message.fields.weatherText, color: "#1890ff" },
      weatherTemp: { value: message.fields.weatherTemp, color: "#1890ff" },
      weatherHigh: { value: message.fields.weatherHigh, color: "#1890ff" },
      weatherLow: { value: message.fields.weatherLow, color: "#1890ff" },
      weatherHumidity: { value: message.fields.weatherHumidity, color: "#1890ff" },
      weatherGreeting: { value: message.fields.weatherGreeting, color: "#389e0d" },
      loveDays: { value: message.fields.loveDays, color: "#ff4d4f" },
      birthdayDays: { value: message.fields.birthdayDays, color: "#fa8c16" },
      quoteEn: { value: message.fields.quoteEn, color: "#2f54eb" },
      quoteZh: { value: message.fields.quoteZh, color: "#389e0d" }
    }
  };

  const data = await httpJSON(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  });

  if (data.errcode !== 0) {
    throw new Error(
      `WeChat send error: ${data.errcode} ${data.errmsg || ""}`.trim()
    );
  }

  return data;
}

async function composeAndSend() {
  mustEnv();
  const [accessToken, weather, quote] = await Promise.all([
    getWeChatAccessToken(),
    getWeatherOfTianjin(),
    getDailyQuote()
  ]);

  const message = buildMessage({ weather, quote });
  const sendResult = await sendTemplateMessage(accessToken, message);

  return {
    sentAt: new Date().toISOString(),
    weather,
    quote,
    message: message.plainText,
    wechat: sendResult
  };
}

async function sendOnce() {
  try {
    const result = await composeAndSend();
    console.log("微信模板消息发送成功");
    console.log(`发送时间：${result.sentAt}`);
    console.log(result.message);
    return true;
  } catch (err) {
    console.error("微信模板消息发送失败：", err.message);
    return false;
  }
}

function startDailySchedule() {
  let lastRunDate = "";

  console.log(
    `定时发送已开启：每天 ${String(ENV.dailyPushHour).padStart(2, "0")}:${String(
      ENV.dailyPushMinute
    ).padStart(2, "0")} 发送`
  );

  setInterval(async () => {
    const now = new Date();
    const today = fmtDate(now);
    const isDue =
      now.getHours() === ENV.dailyPushHour &&
      now.getMinutes() === ENV.dailyPushMinute;

    if (!isDue || lastRunDate === today) return;

    const ok = await sendOnce();
    if (ok) {
      lastRunDate = today;
    }
  }, 10000);
}

if (ENV.sendOnce || !ENV.enableSchedule) {
  const ok = await sendOnce();
  if (!ok) {
    process.exitCode = 1;
  }
} else {
  startDailySchedule();
}
