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

## 每局累计时长（manato-v20 起）

新增 `game_run_record`：每约 30 秒、切后台、离开页面、完成一局时上报当前局累计有效秒数。
`run_id` 是每次开局生成的随机编号，不识别玩家、不会写入存档或长期储存。
`run_seconds` 是从本局开始累计的前台游戏秒数（整数）；`run_status` 为 checkpoint/background/pagehide/completed。
暂停、后台、加载和结束动画不计时；重玩创建新编号。结束后的离开不会重复报告结束。
页面从浏览器缓存恢复时沿用原编号继续累计。

**这些是累计快照，不能相加。** 每局时长取同一 run_id 的 MAX(run_seconds)。
各国最长已观测游玩记录取该国 game_run_record 的 MAX(run_seconds)；只看完整通关局时筛选 run_status=completed。
累计总游玩时长和人均仍使用原有 game_play_time.value 的和，不混入新快照。
game_end 也附带 run_id 和 run_seconds。

GA4 自定义事件维度：run_seconds（单局累计秒数）、run_status（时长记录状态）。
可在探索中结合国家/地区查看时长取值并导出求最大值；不要把这些数值的事件计数当时长。
run_id 保留在事件参数中，不注册高基数维度。
历史数据无法补算。异常崩溃/强制关闭/网络中断仍可能丢失末尾数据，未完成局只是最长已观测时间。
