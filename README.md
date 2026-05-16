# wechat-daily-service

每天定时向微信测试号关注者发送一条模板消息，内容包括：

- 日期、具体时间、星期几
- 天气和天气提醒
- 相爱天数
- 生日倒计时
- 每日一句

## 本地运行

需要 Node.js 18 或更高版本。

先复制 `.env.example` 为 `.env`，然后填写自己的配置：

```bash
npm start
```

本地默认会按 `.env` 里的时间常驻定时发送：

```env
ENABLE_SCHEDULE=true
DAILY_PUSH_HOUR=8
DAILY_PUSH_MINUTE=0
```

如果只想发送一次，可以这样运行：

```bash
$env:SEND_ONCE="true"; node index.js
```

## GitHub Actions 定时发送

项目已包含 `.github/workflows/daily-wechat.yml`，默认每天北京时间 08:00 自动运行一次。

在 GitHub 仓库里进入：

`Settings` -> `Secrets and variables` -> `Actions`

添加这些 Repository secrets：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_TO_USER_OPENID`
- `WECHAT_TEMPLATE_ID`
- `LOVE_START_DATE`
- `BIRTHDAY`
- `ALIYUN_APPCODE`

可选添加 Repository variables：

- `TARGET_CITY`
- `ALIYUN_WEATHER_URL`

保存后把代码推送到 GitHub。之后可以在 `Actions` 页面手动点 `Run workflow` 测试一次，也可以等每天定时触发。

## 微信模板字段

公众号测试号模板里不要填写 JavaScript 里的 `${today}`、`${weather.city}` 这种写法。微信不会执行这些表达式，会原样显示。

请在测试号模板内容里使用微信自己的占位符，例如：

```text
🌅 早安，亲爱的小姜宝宝！

📅 今天是 {{date.DATA}}
🌤️ {{weatherCity.DATA}}天气：{{weatherText.DATA}}℃
当前 {{weatherTemp.DATA}}℃，最高 {{weatherHigh.DATA}}℃，最低 {{weatherLow.DATA}}℃，湿度 {{weatherHumidity.DATA}}。
{{weatherGreeting.DATA}}

💞 今天是我们相爱第 {{loveDays.DATA}} 天
🎂 距离你的生日还有 {{birthdayDays.DATA}} 天

💌 {{quoteZh.DATA}}
🌹 {{quoteEn.DATA}}
```

代码中发送的数据字段为：

- `date`
- `weatherCity`
- `weatherText`
- `weatherTemp`
- `weatherHigh`
- `weatherLow`
- `weatherHumidity`
- `weatherGreeting`
- `loveDays`
- `birthdayDays`
- `quoteEn`
- `quoteZh`
