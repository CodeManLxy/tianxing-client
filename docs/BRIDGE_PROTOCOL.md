# 外部通信协议概要

本文只描述客户端接口，不包含 MT5 实现或指标计算算法。

以配置的公共 Files 路径为起点：

```text
TXJ_Client/<bridgeId>/
  state.json
  snapshots/<chart_id>.json
  inbox/<uuid>.json
  outbox/<uuid>.json
  journal/<uuid>.json
```

- `state.json` 使用 `txj.client.state.v1`，包括心跳、会话、连接与交易权限、账户、合约、图表来源、挂单、持仓和成交记录。
- 心跳超过 5 秒提示延迟，超过 30 秒判定离线；离线拒绝执行。快照还需通过自身的新鲜度和身份校验。
- `sources` 描述图表的品种、周期、快照 ID、可读性和证据时效。`snapshots` 保存外部指标的结构输出；客户端不会计算另一套指标代替它。
- 指令使用 `txj.client.command.v1`，绑定账户、服务器、EA 会话，包含 UUID、创建时间、30 秒有效期、操作和参数，原子写入 `inbox`。
- 回执状态为 `processing`、`accepted`、`rejected`、`unconfirmed`。客户端写入队列后显示 `submitted`；超过有效期没有最终回执时显示未确认，不自动重发。
- `accepted` 表示券商接受操作，不代表成交。最终状态以终端实际挂单、持仓和成交为准。
- 新挂单只接受 `BUY_LIMIT` / `SELL_LIMIT`。客户端按净值预算、合约跳动、亏损 Tick Value 和手数步长估算，手数向下取整。外部执行端仍应校验报价、权限、预算和券商交易预检。
- 联合分析保存策略、周期和分析批次标记。每个周期每轮最多一笔，未勾选周期不可执行；同账户预算会累加。

完整客户端校验见 `src/core.cjs`、`src/risk.cjs`、`src/execution.cjs` 和 `src/analysis-run.cjs`。测试中的账户、价格和回执均为合成值。
