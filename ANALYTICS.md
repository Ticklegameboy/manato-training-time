# Manato 私人统计

GA4 资源：Manato Training Time（560592808）；衡量 ID：G-EJPXP8NZ47。
后台：https://analytics.google.com/analytics/web/#/a413319928p560592808/reports/intelligenthome
报表需要已授权的 Google 账号登录，游戏中不显示统计后台。

- page_view：页面打开次数。
- game_start：实际进入游戏；查看此事件的「使用者总数」估算玩家人数，事件次数是开局次数（含重玩）。
- game_play_time：前台实际游戏时长，active_play_seconds；每 30 秒、切后台、离开、结束时提交。
- game_end：体力耗尽完成一局。
- game_load_complete / game_load_failed：加载成功 / 失败。

仅正式站点的本游戏路径启用。不会发送存档、输入内容、URL 查询参数或原始异常信息。
禁用广告个性化与 Google Signals。被拦截时不影响游戏。
统计从部署后开始，不能还原历史；换设备、清 Cookie、拦截统计可能使人数存在误差。常规报表可能延迟 24–48 小时。

验证：node tools/verify-analytics.cjs
