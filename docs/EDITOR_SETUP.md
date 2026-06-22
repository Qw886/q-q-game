# Cocos Creator 编辑器设置

阶段 1 需要在编辑器中把启动组件挂到现有 Canvas 节点上。代码会在运行时创建主菜单和静态棋盘，不需要手工创建其他 UI 节点。

## 操作步骤

1. 打开 Cocos Creator 3.8.8，并打开 `mahjong-link` 项目。
2. 等待资源刷新和 TypeScript 编译完成。
3. 在 Hierarchy 中选中 `Canvas` 节点。
4. 在 Inspector 中点击“添加组件”。
5. 搜索 `GameBootstrap`。
6. 添加 `GameBootstrap` 组件。
7. 保存 `assets/scenes/Main.scene`。
8. 点击编辑器顶部预览按钮运行。

## 预期结果

运行 `Main.scene` 后，首先看到标题“雀牌连线”和普通、中等、困难三个模式按钮。点击“普通模式”后进入游戏界面，顶部显示“模式：普通、剩余：80、分数：0、时间：20”，中间显示 10 行 x 8 列共 80 张占位麻将，底部显示“返回菜单”按钮。点击“返回菜单”后回到模式选择页面。

中等和困难按钮本阶段只显示“该模式将在后续阶段开放”，不会进入棋盘。

游戏界面会按当前 Canvas 可见尺寸划分为顶部状态栏、中央棋盘区和底部操作区。建议重点验证 720x1280、1080x1920 竖屏预览；1280x720 横屏只要求内容完整且不互相遮挡。

## 阶段 2 路径算法调试

`LinkPathFinderDebugRunner` 只用于开发验证，不要长期挂在场景里。

1. 等待 Cocos Creator 资源刷新和 TypeScript 编译完成。
2. 在 Hierarchy 中选中 `Canvas` 节点。
3. 在 Inspector 中点击“添加组件”。
4. 搜索并添加 `LinkPathFinderDebugRunner` 组件。
5. 点击预览运行。
6. 打开 Console，确认每个路径测试输出 `PASS`，最后显示失败数量为 0。
7. 测试结束后，停止预览。
8. 回到 `Canvas` 节点，在 Inspector 中移除 `LinkPathFinderDebugRunner` 组件。
9. 保存场景前确认只保留正式需要的 `GameBootstrap` 组件。

## 阶段 3 可玩版本验证

阶段 3 不需要新增挂载组件，继续使用 `Canvas` 上已有的 `GameBootstrap`。

1. 等待 Cocos Creator 资源刷新和 TypeScript 编译完成。
2. 确认 `Canvas` 节点只保留正式需要的 `GameBootstrap`，不要保留 `LinkPathFinderDebugRunner`。
3. 点击预览运行。
4. 进入“普通模式”。
5. 点击一张麻将，确认有选中效果；再次点击同一张，确认取消选中。
6. 点击相邻的相同麻将，确认显示短暂连线、两张牌隐藏、剩余数量减少 2、分数增加、时间恢复 20。
7. 点击不可连接的相同麻将，确认出现失败反馈且不消除。
8. 等待倒计时到 0，确认显示“时间结束”结算界面。
9. 点击“重新开始”，确认棋盘、分数、剩余数量和时间恢复。
10. 点击“返回菜单”，确认回到模式选择页且倒计时停止。

## 阶段 4 随机棋盘与死局验证

正式试玩不需要新增组件，继续保留 `Canvas` 节点上的 `GameBootstrap` 即可。

1. 等待 Cocos Creator 资源刷新和 TypeScript 编译完成。
2. 确认 `Canvas` 节点只保留正式需要的 `GameBootstrap`，不要长期保留调试组件。
3. 点击预览并进入“普通模式”。
4. 观察 Console 中只输出一次阶段 4 摘要：seed、generationStrategy、openingMoves、zeroTurnMoves、oneTurnMoves、twoTurnMoves、adjacentMatchingMoves、firstTenStepsAverageMoves、difficultySelectionAttempts 和 accepted。
5. 点击可连接的同图案麻将，确认消除后剩余数减少、倒计时恢复，并且游戏继续检测是否死局。
6. 如果出现“无可消除组合”，确认倒计时停止、棋盘不可继续点击，并可点击“重新开始”或“返回菜单”。
7. 多次点击“重新开始”，确认棋盘通常变化，Console 中 seed 也随之变化。

`Stage4DebugRunner` 只用于开发验证，不要长期挂在场景里。

1. 在 Hierarchy 中选中 `Canvas` 节点。
2. 在 Inspector 中点击“添加组件”。
3. 搜索并添加 `Stage4DebugRunner`。
4. 点击预览运行。
5. 打开 Console，确认每项输出 `PASS`，最后显示 `Stage4测试完成：通过X，失败0`。
6. 停止预览。
7. 回到 `Canvas` 节点，在 Inspector 中移除 `Stage4DebugRunner`。
8. 保存场景前再次确认只保留 `GameBootstrap`。
## 阶段5：三种模式验证

正式试玩时保持 `GameBootstrap` 挂载在 Camera 节点，不需要重新挂载。不要把调试组件长期保留在 `Main.scene`。

临时运行 `Stage5DebugRunner`：

1. 等待 Cocos Creator 资源刷新。
2. 选中 Hierarchy 中的 Canvas 或 Camera 节点。
3. 点击 Inspector 的“添加组件”。
4. 搜索并添加 `Stage5DebugRunner`。
5. 点击预览运行，查看 Console 输出普通、中等、困难各 3 个固定种子的结果。
6. 验证结束后，从节点上移除 `Stage5DebugRunner`，保存场景。

三种模式试玩：

1. 进入普通模式，确认 80 张麻将、20 秒倒计时、1.0x 倍率。
2. 进入中等模式，确认 120 张麻将、14 秒倒计时、1.5x 倍率。
3. 进入困难模式，确认 192 张麻将、9 秒倒计时、2.0x 倍率。
4. 分别验证消除、连线、计分、倒计时重置、超时失败、死局失败、重新开始和返回菜单。
5. 在三种模式之间反复切换，确认不会残留旧倒计时、旧棋盘或重复事件。
6. 切换 720x1280 竖屏和 1280x720 横屏预览，确认 HUD、棋盘和底部按钮不重叠。
