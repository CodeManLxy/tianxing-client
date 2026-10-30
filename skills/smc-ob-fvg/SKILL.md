---
name: smc-ob-fvg
description: 按真实挂载SMC指标的有效OB制定限价交易计划，FVG与Sweep/MSS仅辅助；按净值风险预算计算手数，遵从客户端AI直接挂单开关。
---

# 天行健有效 OB 交易模型 · 2.4

本轮以当前用户要求和本文件为准，旧聊天里“必须同腿新鲜FVG、必须最新CHOCH/MSS、必须首次触及、止损≤1.5ATR”的旧限制已经废止。一般聊天、软件问答、教学或用户明确只分析时不下单。

## 核心判断

以指标实际导出的有效 OB 为交易依据。只要 OB 的方向、边界和有效性有真实证据，能够确定合理入场、结构外止损、真实目标，价格 RR≥1，且风险预算及券商条件通过，即可制定计划。

以下仅为辅助，不能单独构成“不交易”理由：
- FVG 是否存在、是否同腿、是否与 OB 重叠、是否已完全回补。
- Sweep、MSS、最近 CHOCH/BOS、指标信号箭头、signal/action/stage/sequence、rule_score 的70分线。
- OB 是否首次触及、事件是否在20根K线内、止损是否小于1.5ATR。
- 高低周期是否完全同向；分歧应说明风险，不自动否决。
- InpOBDetection 是否为1；按真实模式解释OB，不把极值模式谎称为最后反向源柱。

“FVG均已回补”不等于OB失效；“MSS被推翻”也不自动等于OB失效。必须独立检查OB本身的失效规则、mitigated/status和当前价格。有破坏证据的OB仍不能交易，不能为了增加机会隐瞒失效。

## 读取证据

1. 读取 get_chart_info/list_smc_sources/get_server_time/get_terminal_info，优先使用客户端选中的 chart_id；目标不明确时先确认图表。
2. 用 get_smc_data 读取 summary、settings、order_blocks、candles，按需读取 structure_breaks、fair_value_gaps、swing_pivots、internal_pivots、targets、objects 等。分页加offset并传同一snapshot_id；快照变更重新读取，不拼接不同版本。
3. 核对 analysis_ready、market_evidence_stale、as_of、last_closed_bar。数据过期、不可读、边界不明或无法证明OB仍有效时等待；不能从旧聊天复制价格。
4. OB至少要求：mitigated=false，status为fresh或tested，边界top>bottom，方向明确。允许tested且尚未失效的OB，说明此前测试和仍有效的理由。内部/波段均可，选择时说明层级，不混用两个OB的边界。
5. 读取 get_account_info 与 get_symbol_info 的账户、净值、合约、Bid/Ask和报价时间。已能从工具读取的信息不得再写成“用户没提供”。工具没有get_bars/get_screenshot，不得虚构调用或声称看过截图。
6. 数据只导出已收盘柱；结合最新报价及刷新快照检查后续破坏，不能用快照fresh标记冒充当前没有触及。显示开关与导出范围须如实说明。

## 入场、止损与目标

- 新计划仅 BUY_LIMIT / SELL_LIMIT。入场位于所选OB区间；优先有依据的边界、OB中点或与有效FVG重叠位置。没有有效FVG可直接按OB计划，不补造FVG。
- 价格按最小跳动对齐。BUY_LIMIT须低于当前Ask，SELL_LIMIT须高于当前Bid；已越过挂单价时不擅自转市价追单。
- SL放在OB边界和必要结构失效点之外，至少留一个最小跳动，并考虑真实点差。不能把SL塞进OB来缩小手数风险。
- 不再用1.5ATR作为放弃条件；先确定合理SL，再通过降低手数控制金额。若最小手数仍超预算，放弃而非提高风险比例。
- TP来自已读到的结构高低点、流动性或其他可验证目标，不虚构价格凑RR。多单RR=(TP-E)/(E-SL)，空单RR=(E-TP)/(SL-E)，须≥1。
- 本模型的有效性判断不等于盈利保证。报告已测试、逆高周期、目标障碍等具体风险，让风险体现在选择、止损和手数中。

## 默认风险

- 总额默认采用当前连接账户的净值equity。单笔预算默认1%，用户可选1%–2%，模型不能自行提高到2%。自动模式以开关旁设置的比例为准。
- 价格计划成立后调用 estimate_trade_risk(symbol,type,price,sl,risk_percent)（联合分析需再传所属chart_id），计算建议手数、预算和预估损失；不靠模型心算猜测手数。
- 按合约步长向下取整；1%是预算档位，不要求实际亏损达到1%。最大点差未指定时采用当前真实点差加一个最小跳动。
- 估算不含手续费、库存费、滑点和跳空影响，不保证实际亏损严格封顶。提交时客户端重新校验，通信EA使用OrderCalcProfit、最新净值比例上限和OrderCheck复核。
- 账户/合约暂缺时可以保留有证据的价格计划并标记待风险校验；不得提交或假设账户资金。

## 执行权限与结果

- 客户端具备交易执行通道。先调用 get_terminal_info，按 ai_direct_execution 和 execution_status 的真实值判断。
- 开关关闭：只提供计划，使用“填入交易表单→人工确认→通信EA”的路径，状态为待确认。
- 开关开启且ai_direct_execution=true：本轮属于交易分析、用户未要求只分析、条件通过时，可调用place_limit_order直接提交；无需再次要求人工逐笔确认。开启开关本身不启动交易。
- place_limit_order必须引用已读取的chart_id/snapshot_id/ob_index（全局数组下标），并给出type/price/sl/tp/reason。客户端从真实OB校验方向、区域、SL，按授权比例计算手数，模型无权覆盖风险上限。
- 单周期每次分析最多新建一笔；联合分析时每个已勾选周期各最多一笔，未勾选周期不得提交；各周期使用自己的风险比例并汇总新单预算，同一OB不得重复挂单；已有未确认指令时先查回执。关闭开关会禁止新AI指令，不会自动撤销已经提交的订单。
- submitted/processing只是发送或处理中；accepted只是券商已接受，要报告order/deal并回查挂单持仓；rejected说明真实拒绝原因；unconfirmed不自动重发，调用get_command_result并回查MT5。
- AI直接工具只支持新建限价挂单。撤单、修改、平仓仍在交易页人工确认；不得调用不存在的执行工具。

## 输出

1. 图表与证据：品种/周期/chart_id、快照时刻、OB模式、数据可读与缺失项。
2. OB判断：层级、方向、区间、源柱与确认时间、fresh/tested状态、仍有效或失效的依据；FVG/结构/评分只列为辅助说明。
3. 条件通过时给计划：OB依据、入场、SL及失效边界、真实TP及RR、账户净值、风险比例、预算、建议手数、预估损失和点差上限。
4. 最终状态：等待 / 待风险校验 / 待人工确认 / 已发送待回执 / 券商已接受 / 已拒绝 / 结果未确认。自动提交时附真实指令ID和订单编号，不声称已经成交，也不再引导重复点击表单。
必要价格证据不足时明确列出缺失项，不编造价格。不能只因为辅助条件不足或缺少逐笔人工确认而放弃。
