# Agent Note: 鲸吟皮肤抽取为独立皮肤仓库

Status: implemented

## Problem

鲸吟（whale-song）皮肤原本作为唯一内置资产打包在皮肤中心包里。作者希望把
皮肤与加载器解耦：皮肤拥有独立、可单独维护版本的仓库，由用户手动安装，
皮肤中心不再内置任何皮肤。

## Decision

1. 新建独立皮肤仓库 `znc15/dsh-skin-whale-song`（公开，单条全新提交），
   内含完整 v2 皮肤资产（skin.json / skin.css / patches.css / hooks.mjs /
   assets / preview）、中英双语安装 README、Apache-2.0 LICENSE，以及
   `dsh-market.provenance.json`——对 `skin.json` / `hooks.mjs` /
   `skin.css` 做 sha256 钉扎，使皮肤中心在手动安装后仍把 favicon 钩子
   视为可信。
2. 从 dsh-web-plugins 移除内置皮肤：
   - 删除 `packages/skins/skin-center/skins/`；包 `files` 白名单不再
     含任何 `skins/*` 条目。
   - `DEFAULT_SKIN_ID` 仍为 `whale-song`，但只是「用户皮肤目录里存在
     该皮肤时的首次启动默认」；空目录册保持官方默认外观。
   - market-build / gallery-build 容忍空皮肤目录册；重新生成的
     market/gallery 产物为零皮肤。
   - 根 README 移除一览图与逐皮肤小节，皮肤章节改指独立仓库。

## Constraints

- v2 皮肤契约保持不变：皮肤仍是纯资产目录、由皮肤中心加载，不复活
  每皮肤独立 npm 插件形态。
- provenance 记录的是仓库此前发布过的同一批已评审字节；文件缺失或被
  篡改时只拒绝 hooks 面（favicon），不影响声明式皮肤。
- 用户操作路径：把仓库克隆/复制到 `$DSH_HOME/skins/whale-song/`
  （回复「安装」即可在当前机器应用，dsh web 重启后生效）。

## Source record

抽取动作遵循 2026-08-25 规划轮次中作者的「独立皮肤仓库」决定；
此前的内置默认行为记录在 2026-08-24 的 note 中。
