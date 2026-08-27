# Agent Note: 底部统计栏直线边框、设置面板不透明度与皮肤选项平铺

Status: implemented

## Problem

作者在上一批改动后提出三项界面修正：

1. 底部 Token 统计栏虽已是圆角长方形，但圆角 22px 超过了栏高的一半
   （34px），左右两端几乎成了圆弧/胶囊，缺少「直边」。
2. 设置弹窗面板底色一直用半透明 layer token（约 60% alpha），桌面背景
   透进来，内容不够清晰。
3. 皮肤中心把 5 个背景滑块 + Wallpaper Engine + 自定义主题折进了默认
   收起的「高级设置」下拉框，作者要求每个选项独立平铺显示、删除
   Wallpaper，主题类内容全部保留（经询问确认）。

## Decision

1. **统计栏直线边框**（鲸吟 skin `patches.css`）：
   `--dsh-composer-accessory-radius` 由 22px 降到 10px——低于栏高一半，
   视觉仍是圆角长方形，但左右边框中段恢复为直线，不再像胶囊。
2. **设置面板不透明度**（鲸吟 skin `patches.css`）：
   `[data-dsh-surface="settings"][role="dialog"]` 增加
   `background: var(--dsw-alias-bg-overlay)`（浅色/深色均为 ~92% alpha），
   覆盖官方面板源自 layer token 的 60% 半透明底色；遮罩层不动。
3. **皮肤中心平铺**（skin-center）：
   - 删除「高级设置」`<details>` 下拉框与 summary 行；5 个滑块（背景遮挡、
     空/有对话背景模糊、输入卡模糊、气泡不透明度）直接平铺在皮肤列表下方，
     每个选项独立成行，配一行 `controlsHint` 引导文案。
   - 删除卡片中的 `WallpaperPanel` 渲染（组件与 host 桥保留：壁纸选择仍在
     `skin-wallpaper` 命名空间持久化，切换皮肤时仍清除已持久化的壁纸选择）。
   - 自定义主题卡保留并按作者确认直接平铺展示。
   - 移除 `.advanced*` CSS，新增 `.controlsHint`；更新 en/zh
     `advancedHint` 文案与 README 对（壁纸面板 → host-only 桥）。

## Constraints

- 皮肤改动不动 skin.json / hooks.mjs，provenance hooks 信任不受影响；
  只同步已安装的 `~/.dsh/skins/whale-song/patches.css`。
- Wallpaper Engine host 侧（we-* 路由、控制器、导入能力）与本包测试全部
  保留；仅是皮肤中心卡片不再渲染壁纸面板。
- 自定义主题层、皮肤目录册、原子切换引擎等其余功能不受影响。

## Source record

作者 2026-08-26 的三条口头需求；本批已实现并推送
`znc15/dsh-web-plugins` 与 `znc15/dsh-skin-whale-song`。
