# TianXingBridge 通信 EA 2.50

配套客户端 2.6.0，协议能力为 `json_multiline_v2`。安装步骤见 [详细安装说明](../docs/安装使用说明.md)，多周期用法见 [多周期分析指南](../docs/多周期分析指南.md)。

| 文件 | 说明 |
| --- | --- |
| `TianXingBridge.ex5` | 可直接安装的编译文件 |
| `TianXingBridge.mq5` | 通信 EA 主源码 |
| `Json.mqh` | JSON 解析/序列化依赖 |
| `SMCRead.mqh` | 读取外部指标输出的适配层，不包含结构/OB/FVG 的计算算法 |
| `SHA256SUMS.txt` | 上述四个文件的 SHA-256 校验 |
| `LICENSE-GPL-3.0.txt` | 通信 EA 组合及其 JSON 依赖的 GPL-3.0 许可证 |

四个通信文件放到同一 `MQL5/Experts/TianXingBridge/` 目录。已有 `.ex5` 可直接挂载；源码编译时打开主 `.mq5`，按 F7。`Json.mqh` 保留原有 UTF-16LE 编码，主源码和适配层也保留既有文件编码，请使用 MetaEditor 编辑。

默认 `InpAllowTrading=false`。一个终端只挂一个通信 EA，各需分析的周期分别挂你已有的兼容 SMC 纯指标 1.02，并开启指标导出。**本目录不提供指标源码、指标编译文件或指标算法。**

## 来源与许可证

`Json.mqh` 来自既有 MetaTrader-AI 中文项目中的 `tools/JSON.mqh`，本次随通信 EA 发布时保持文件字节不变。该项目的上游为 [jblanked/metatrader-ai](https://github.com/jblanked/metatrader-ai)，上游按 [GPL-3.0](https://github.com/jblanked/metatrader-ai/blob/master/LICENSE) 发布。

通信 EA 与此依赖组成的源码和编译文件按随附 GPL-3.0 许可证发布，并同时提供可对应编译的源码及依赖。此说明不把上游依赖重新许可为 MIT，也不声称其为本项目原创。独立 Electron 客户端继续使用仓库根目录的 MIT 许可证；未发布的指标不包含在这些授权中。

发布的 `.ex5` 与既有验证的 2.50 产物逐字节一致。本次未修改交易算法或默认权限，也未为发布而向券商发送订单。若在不同 MetaEditor 版本或编译设置下重新编译，二进制哈希可能不同；应以你实际编译的文件为准。
