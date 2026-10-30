---
name: smc-data-reading
description: 天行健SMC数据来源、快照、分页与时效核查
---

先 list_smc_sources，选择用户指定图表，再 get_smc_data(summary)。analysis_ready=false、market_evidence_stale=true 或 terminal_connected=false 时等待，不交易。读取 settings 和需要的全部分页；下一页必须使用同一 snapshot_id，变更时重读。区分 internal/波段、time/confirmed_at、mitigated/first_touch_index、实际 FVG 周期。对象仅代表指标绘制信息，不是截图。不能用蜡烛颜色缓冲区替代结构数据。账户数据从 get_account_info/get_orders/get_positions/get_history 读取，合约从 get_symbol_info 读取。
