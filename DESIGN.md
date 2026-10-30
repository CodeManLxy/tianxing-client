---
name: 天行健交易工作台
description: Windows Electron 深色交易工作台的已实现视觉规范
colors:
  bg: "#111b26"
  panel: "#172431"
  raised: "#1d2c3b"
  line: "#304151"
  text: "#e6edf3"
  muted: "#a6b6c5"
  gold: "#d5b777"
  blue: "#8bbaf2"
  red: "#ffaaa5"
  green: "#83d7bc"
  sidebar: "#0c151f"
  field: "#101d29"
  primary-text: "#18212c"
  control-hover: "#2b4053"
  primary-hover: "#e7cb91"
typography:
  headline:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.6
  body:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  field: "5px"
  control: "6px"
  message: "7px"
  panel: "8px"
spacing:
  tight: "8px"
  compact: "12px"
  normal: "16px"
  inset: "18px"
  section: "22px"
  wide: "24px"
  large: "32px"
components:
  button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-hover:
    backgroundColor: "{colors.control-hover}"
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "9px 11px"
---

# Design System: 天行健交易工作台

## Overview

**Creative North Star: Windows 深色交易工作台。** 用户已确认的方向是深海蓝底、暖金活动项与蓝色焦点。界面以清晰文字、紧凑操作区和可核查数据为中心，适合在桌面持续使用。

本文件记录当前实现，依据 `ui/style.css`、`ui/index.html` 和 `PRODUCT.md`；规范中的数值均来自现有代码。主要特征是固定左导航、四页工作区、平面分区，以及明确的操作与状态颜色。

## Colors

- **Primary — 暖金 `gold`：** 品牌、主按钮、选中导航与表格标签、分析角色标签、技能标记和输入光标。主按钮配深色文字，悬停使用 `primary-hover`。
- **辅助色 — 浅蓝 `blue`：** 键盘焦点与用户消息角色标签。
- **状态色 — 浅绿 `green`、浅红 `red`：** 分别表示在线／正值和错误／负值／危险操作；状态同时保留文字说明。
- **Neutral：** `bg` 是主工作区；更深的 `sidebar` 是导航；`panel` 用于证据栏、编辑提交区、用户消息和表格悬停；`raised` 用于普通按钮；`field` 用于输入控件。`line` 分隔区域，`text` 与 `muted` 区分正文和辅助信息。

## Typography

全部界面优先使用 Segoe UI，中文回退 Microsoft YaHei，再回退系统无衬线字体。按钮和表单继承正文字体。

- 页面标题使用 `headline`；区域标题使用 `title`；正文使用 `body`；表单标签、表格与辅助说明主要使用 `label`。
- 页面副标题为 13px；较细的发送提示与版本信息为 11px。欢迎标题为 25px，账户摘要数值为 22px、字重 500。
- 对话正文行高 1.85，欢迎说明为 1.9，技能编辑器为 13px／1.7。账户摘要与交易表格启用 `tabular-nums`，便于纵向比较数字。
- 对话保留换行并允许长内容折行；交易表格保持单行内容，通过横向滚动容纳更多列。

## Layout

窗口占满视口，外层不滚动；当前页、对话、证据栏与表格按各自区域滚动。左导航宽 200px，内边距 28px 16px，连接状态与版本置底。主区内边距 30px 32px 24px；页头左侧为标题与说明，右侧为数据时效，页头下方留 22px。

| 页面 | 已实现的结构 |
| --- | --- |
| 分析对话 | 两列为 `minmax(420px, 1fr) 270px`。左侧依次为图表工具栏、可滚动对话和底部输入区；右侧证据栏展示图表来源与启用技能。整体使用单一边框容器。 |
| 交易与盈亏 | 顶部账户指标横向排列并允许换行。下方是可伸缩账本与 290px 操作表单，间距 24px；账本含四个标签与粘性表头，表单通过左边线分区。 |
| Skills 管理 | 顶部共享工具栏，下方为 265px 技能列表与可伸缩全文编辑器。编辑器依次安排标识／启用状态、正文、操作栏和可折叠参考文件；正文最小高度 280px。 |
| 连接与设置 | 左侧表单宽 `minmax(380px, 600px)`，右侧连接指引为 `minmax(250px, 1fr)`；列间距 60px，总宽不超过 1150px。指引以左边线与 30px 内缩分区。 |

常用控件间距为 8–12px，表单双列间距为 12px，区域内缩主要为 16–24px；相邻证据或设置分组间隔 32px。

当前只有一个紧凑桌面断点：窗口宽度不超过 1200px 时，左导航缩至 170px，主区内边距变为 23px 22px；分析列变为 `minmax(400px, 1fr) 220px`，交易右栏为 265px、间距 14px，技能列表为 220px，设置列间距为 24px。四页均继续保持桌面分栏。

## Elevation & Depth

当前界面不使用阴影、渐变或背景模糊。层级由深浅底色、1px 分隔线、留白和文字层级表达；普通操作悬停改变底色，交易行悬停使用面板底色。通知位于页头下方，使用独立底色与描边，错误通知同时改变文字颜色。

## Shapes

输入控件与小区域使用 5px 圆角，按钮使用 6px，用户消息使用 7px，分析工作区外框使用 8px。大区域优先使用直线分栏与分隔线；账本活动标签使用暖金底边和直角。品牌标记为单色描边 SVG，与品牌文字同用暖金。

## Components

- **按钮：** 普通按钮使用抬升底色与 1px 分隔色描边。主按钮使用暖金实底、字重 600；安静按钮透明背景；危险操作使用浅红文字。禁用按钮透明度为 0.5，并显示等待光标。
- **输入控件：** 深色底、1px 描边、统一内边距。标签紧邻字段，双列字段等宽。多行输入允许纵向调整；对话输入高度为 70–220px。占位提示使用浅灰蓝，输入光标使用暖金。
- **键盘焦点：** 输入框、选择框、多行输入、按钮和折叠标题统一使用 2px 浅蓝外轮廓，偏移 2px。
- **主导航：** 纵向排列，间距 8px，按钮内边距 12px 16px。默认透明背景、辅助文字色；活动项改为深灰蓝底与暖金文字。
- **对话与证据：** 用户消息有面板底色和内缩，分析回复以正文直接呈现；角色标签提供来源区分。证据按条目使用底边线分隔，技能名称以暖金突出。
- **账本：** 12px 字号、单行单元格与粘性表头；数字默认右对齐，首列左对齐；单元格内边距 12px 10px，行间使用底边线。空状态在表格区域居中显示辅助文字。
- **技能列表：** 每项占满列表宽度，名称下方可带辅助说明。选中项使用更亮底色与边框；编辑器保留完整正文，参考内容放在折叠区域。

## Do's and Don'ts

- **Do** 延续现有深海蓝、暖金、浅蓝的分工与统一字体层级。
- **Do** 保持固定左导航和四页现有分栏，使用区域内滚动承载长内容。
- **Do** 让交易数值对齐，并为连接状态、错误和正负值保留文字表达。
- **Do** 使用边线、底色与留白组织密集内容，保留明确的键盘焦点。
- **Don't** 用额外阴影、渐变或大圆角改变当前平面工作台的形态。
- **Don't** 用占位交易数据替代真实的离线、等待连接或空账本状态。
