# 仿张锡纯辨证施治系统

> 基于《医学衷中参西录》原文构建的中医辨证施治辅助工具
> v3.0 (2026-07-14) — **新增 ZXDE v6 诊方引擎** (症状-方剂投票) + v2.7.20 脉诊过程还原

## 项目目标

模仿张锡纯本人临证思路：**四诊合参 → 病名/证型诊断 → 方剂推荐 → 真实医案参考**

## 核心引擎 (v3.0 新增)

### 🆕 ZXDE v6 诊方引擎
- **演示页**: [`zxde_demo.html`](zxde_demo.html) (浏览器直接打开)
- **数据基础**: 535 方剂 + 1100+ 医案蒸馏 (`zx_by_formula_full.json`)
- **核心算法**: 症状-方剂投票 + 同义词归并 + 模块先验 + 7 条领域硬规则
- **盲测结果**:
  - 模块正确 4-5/7 (57-71%)
  - 临床合理 6/7 (86%) — 全部 7 例都给出同模块/同病机的可用方剂
  - 完全正确 1/7 (气虚下陷 → 升陷汤)
- **设计文档**: [`项目文档/流程/12-ZXDE-v6完整设计文档.md`](项目文档/流程/12-ZXDE-v6完整设计文档.md)

### v2.7.20 一比一还原张锡纯脉诊过程
- **入口**: [`v27_pulse_process.html`](v27_pulse_process.html)
- 5 步引导: 手法 → 分部 → 脉象 → 复合脉 → 主证
- 994 案实证 + 张氏原话驱动 + 4 维加权匹配

## 知识库来源

- **原书**: 《医学衷中参西录》全 8 期 30 卷 (1974 河北人民出版社修订本)
- **原书文本**: `zhangxichun_originals/校后_v2_2018完整版_全8期30卷.txt` (1.65 MB)
- **结构化**: 535 段 (医方 164 / 药物 79 / 伤寒 52 / 医论 35 / 医话 44 / 虚劳 10 / 医案 125)
- **提取 994 个验案**, 60.1% 案含完整脉诊字段
- **蒸馏**: 535 方剂 × 14 字段 (案首/症状/脉诊/辨证/处方/加味/复诊/效果/后注) → `zx_by_formula_full.json` (4.3 MB)
- **7 大模块分类**: 气虚虚劳 / 胸腹升降 / 伤寒温病 / 脑卒中 / 痰饮肺 / 脾胃泄泻 / 女科杂症 (`zx_module_classify.json`)

## 项目结构

```
zhangxichun-bianzhi/
├── README.md                        # 本文件 (项目总览)
│
├── index.html                       # 主入口 (移动端友好)
├── step4match.html                  # 4 步四诊合参 (v2.1 → v2.7 升级)
├── zxde_demo.html                   # 🆕 ZXDE v6 诊方引擎 (浏览器演示)
├── zxde_engine.js                   # 🆕 ZXDE v6 JS 引擎
├── zxde_data.js                     # 🆕 ZXDE v6 JS 数据
├── 链接.txt                         # 所有页面 URL 速查
│
├── v27_*.html                       # v2.7 系列专题页 (8 个, 见下)
│
├── assets/                          # 静态资源
│   ├── style.css                    # 全局样式
│   ├── app.js                       # 主应用脚本
│   ├── step4match.js                # 4 步合参脚本
│   └── data/                        # 知识库 JSON (17+ 个, 见下)
│
├── zhangxichun_originals/           # 原书文本 (1.65 MB 完整版)
│   └── 校后_v2_2018完整版_全8期30卷.txt
│
├── docs/                            # 提取脚本
│   └── extract_v2.6.py              # v2.7 数据提取脚本
│
├── qr/                              # v2.7 专题页二维码
│   └── v27_28pulse.png
│
├── links_qr/                        # 主入口二维码 (空, 待补)
├── screenshots/                     # 截图 (空, 待补)
│
└── 项目文档/                        # 项目文档 (本目录)
    ├── 流程/                        # 流程文档
    │   ├── 1-提取流程.md
    │   ├── 2-构建流程.md
    │   ├── 3-部署流程.md
    │   ├── 4-张锡纯脉诊辨证流程研究.md
    │   ├── 5-994案诊脉原话完整版.md
    │   ├── 6-994案所有脉描述段.md
    │   ├── 7-994案逐案蒸馏.md
    │   ├── 8-994案8维蒸馏.md
    │   ├── 9-994案张氏格式5维蒸馏.md
    │   ├── 9-升陷汤章20案完整蒸馏.md
    │   ├── 10-7大模块Skill模板.md
    │   ├── 10-994案按章节子段拆分.md
    │   ├── 11-按方剂切分全医案.md
    │   └── 12-ZXDE-v6完整设计文档.md  🆕
    ├── 数据/                        # 数据说明
    │   └── 数据字典.md
    └── 版本/                        # 版本历史
        └── 版本日志.md
```

## 页面清单 (v3.0)

| 页面 | tag | 内容 |
|---|---|---|
| `index.html` | — | 主入口 (含 ZXDE v6 入口) |
| **`zxde_demo.html`** | **v3.0** | **🆕 ZXDE v6 诊方引擎演示** |
| `step4match.html` | v2.7.3 | 4 步四诊合参 |
| `v27_28pulse.html` | v2.7.1 | 28 脉完整专题 |
| `v27_zx_formula.html` | v2.7.2 | 19 张氏特色脉 + 78 方剂-脉象矩阵 |
| `v27_5dim_correction.html` | v2.7.4 | 5 维位置修正 |
| `v27_chongqi.html` | v2.7.5 | 冲气上冲 77 节完整摘录 |
| `v27_book_structure.html` | v2.7.6 | 原书 535 段结构 |
| `v27_pulse_total.html` | v2.7.7.1 | 脉诊总统计 (修正版) |
| `v27_combos.html` | v2.7.8 | 319 脉象组合全谱 |
| `v27_pulse_zangfu.html` | v2.7.9 | 脉位-脏腑对应 |
| `v27_combo_query.html` | v2.7.11/14 | 脉象组合查询器 |
| `v27_heart_cun.html` | v2.7.17 | 心脏心包相关案 + 寸位置 (472/46/13/5/2) |
| `v27_pulse_process.html` | v2.7.20 | 一比一还原张锡纯脉诊过程 (5 步引导) |

## 知识库清单 (`assets/data/`)

| 文件 | 大小 | 用途 |
|---|---|---|
| `cases_v2.7.1.json` | 2.2 MB | **核心** 994 案完整提取 |
| `formula_index.json` | 408 KB | 78 张锡纯方剂库 |
| `symptom_index.json` | 800 KB | 症状-方剂反向索引 |
| `case_match_v2.7.json` | 352 KB | 案例匹配索引 |
| `pulse_extended_v2.7.json` | 348 KB | 脉象扩展库 |
| `checklist_v2.7.json` | 48 KB | 70 项勾选表 |
| `pulse_signature.json` | 44 KB | 脉形特征库 |
| `left_right_signature.json` | 24 KB | 左右脉特征 |
| `topic_stats.json` | 20 KB | 主题统计 |
| `part_signature.json` | 4 KB | 分部特征 |
| `press_signature.json` | 8 KB | 重按特征 |
| `checklist_v2.0.json` | 52 KB | v2.0 勾选表 (历史) |
| `combo_index.json` | 1139 KB | 倒排索引 (v2.7.11) |
| `pulse_formula_syndrome.json` | 13 KB | 54 方剂-脉-证 (v2.7.11) |
| `pos_6bu_index.json` | 4 KB | 6 部脉索引 (v2.7.15) |
| `pos_6bu_index_v2.json` | 5 KB | 6 部脉宽匹配 (v2.7.16) |
| `positions_merged.json` | 2 KB | 7 位置合并规则 (v2.7.15) |
| `heart_cun_index.json` | 24 KB | 心相关 + 寸位置 (v2.7.17) |
| `zangfu_cun_index.json` | 202 KB | 5 脏腑 × 6 部脉 × 28 脉 (v2.7.19) |
| **`zhangxichun_pulse_process.json`** | **124 KB** | **5 步脉诊过程数据 (v2.7.20)** |

## 项目流程 (5 阶段)

```
1. 提取脉象组合 (319 唯一组合)  ← 已完成 (v2.7.8)
        ↓
2. 建倒排索引 (组合 → 案)       ← 已完成 (v2.7.11, combo_index.json)
        ↓
3. 脉-证-方三联标注             ← 已完成 (v2.7.11, 54 方剂)
        ↓
4. 输入匹配 (前端)              ← 已完成 (v2.7.11/14, v27_combo_query.html)
        ↓
5. 辨证输出 (产品)              ← 进行中 (v2.7.17 心脏专题)
```

详细流程见 `项目文档/流程/`

## 核心规则

1. 知识库 100% 来自《衷中参西录》原文, 不杜撰
2. 脉象必须可追溯到真实医案
3. 脉诊分左/右手 (左寸/左关/左尺 + 右寸/右关/右尺)
4. 三诊: 望+问+切 (闻留占位)
5. 静态网页, 纯前端, GitHub Pages 部署
6. 方剂推荐基于症状-方剂投票引擎 (ZXDE v6) — 535 方剂 + 1100+ 医案蒸馏证据

## 部署地址

- **GitHub Pages**: https://weishan730827.github.io/zhangxichun-bianzhi/
- **GitHub 仓库**: https://github.com/weishan730827/zhangxichun-bianzhi
- **主入口**: https://weishan730827.github.io/zhangxichun-bianzhi/index.html
- **🆕 ZXDE v6 演示**: https://weishan730827.github.io/zhangxichun-bianzhi/zxde_demo.html
- **4 步合参**: https://weishan730827.github.io/zhangxichun-bianzhi/step4match.html
- **脉象组合查询**: https://weishan730827.github.io/zhangxichun-bianzhi/v27_combo_query.html

## 验证状态 (v3.0 部署校验)

- [x] index.html — 200 OK (含 ZXDE v6 入口卡片)
- [x] **zxde_demo.html (NEW)** — 200 OK
- [x] **zxde_engine.js (NEW)** — 200 OK
- [x] **zxde_data.js (NEW)** — 200 OK (164 KB)
- [x] step4match.html (9 KB) — 200 OK
- [x] v27_28pulse.html (25 KB) — 200 OK
- [x] v27_pulse_process.html — 200 OK
- [x] cases_v2.7.1.json (2.2 MB) — 200 OK
- [x] combo_index.json (928 KB) — 200 OK
- [x] pulse_formula_syndrome.json (13 KB) — 200 OK
- [x] **zx_by_formula_full.json (NEW, 4.3 MB)** — 200 OK
- [x] **zx_module_classify.json (NEW)** — 200 OK

## 当前状态

- [x] 994 案完整提取 (v2.7.1)
- [x] 5 维脉诊位置 (v2.7.4)
- [x] 19 张氏特色脉 (v2.7.2)
- [x] 319 脉象组合 (v2.7.8)
- [x] 535 段原书结构 (v2.7.6)
- [x] 冲气上冲 77 节摘录 (v2.7.5)
- [x] 倒排索引 combo_index.json (v2.7.11)
- [x] 脉-证-方三联 54 方剂 (v2.7.11)
- [x] 前端查询器 v27_combo_query.html (v2.7.11/14)
- [x] 6 部脉宽匹配 修正 (v2.7.16)
- [x] 心脏心包相关案 472 + 寸位置 46 + 升陷汤 13 + 怔忡 5 + 左寸 2 实证 (v2.7.17)
- [x] 535 方剂 14 字段蒸馏 (v3.0) → `zx_by_formula_full.json` 4.3 MB
- [x] 7 大模块分类 (v3.0) → `zx_module_classify.json` 365 方剂
- [x] 升陷汤 20 案完整蒸馏 (v3.0) → `zx_shengxian_complete_v2.json`
- [x] **🆕 ZXDE v6 诊方引擎 (v3.0)** — 症状-方剂投票 / 盲测 5/7 模块对
- [x] **🆕 ZXDE v6 浏览器演示页 (v3.0)** — `zxde_demo.html`
- [ ] 阶段 5: 辨证输出产品化深化 (v3.1+ 待做)

## 详细文档

- [项目流程](项目文档/流程/) — 5 阶段详细说明
- [数据字典](项目文档/数据/) — 12 个 JSON 字段说明
- [版本日志](项目文档/版本/) — v2.0 → v2.7.9 完整历史
