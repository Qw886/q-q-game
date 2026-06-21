# 架构设计文档

## 总体原则

项目使用 Cocos Creator 3.8.8 和 TypeScript。核心算法与 Cocos 显示层分离：棋盘、寻路、生成、合法移动搜索和死局检测应尽量写成纯 TypeScript，避免依赖 `cc` 模块；节点、组件、动画、输入和界面逻辑放在依赖 Cocos Creator 的模块中。

## 建议目录结构

```text
assets/
  scripts/
    config/
      DifficultyConfig.ts
      GameConfig.ts
    core/
      Board.ts
      PathFinder.ts
      BoardGenerator.ts
      MoveFinder.ts
      DeadlockDetector.ts
      GameState.ts
    view/
      TileView.ts
      BoardView.ts
      LinkLineView.ts
    ui/
      MainMenu.ts
      TimerView.ts
      ResultPanel.ts
    storage/
      LocalStorageService.ts
    bootstrap/
      GameBootstrap.ts
docs/
  GAME_DESIGN.md
  ARCHITECTURE.md
  TEST_CASES.md
PLAN.md
```

## 模块职责

`config` 负责难度、倒计时、分数和全局常量，禁止把难度数字散落在业务代码中。

`core` 负责纯游戏规则：棋盘数据、麻将状态、最多两次转弯寻路、可解棋盘生成、合法移动搜索、死局检测和游戏状态流转。该层不直接访问 Cocos 节点。

`view` 负责把核心数据渲染成麻将节点、棋盘布局和连接线显示。它读取 `core` 的结果，但不决定规则。

`ui` 负责主菜单、倒计时展示、结算面板和按钮交互。

`storage` 负责本地最高分和设置，第一版只使用本地存储。

`bootstrap` 负责启动游戏、装配模块、选择默认场景入口。

## 纯 TypeScript 与 Cocos 依赖边界

纯 TypeScript：`Board`、`PathFinder`、`BoardGenerator`、`MoveFinder`、`DeadlockDetector`、大部分 `GameState`。这些文件输入普通对象和数组，输出路径、状态和结果，方便独立测试。

依赖 Cocos Creator：`TileView`、`BoardView`、`LinkLineView`、`MainMenu`、`TimerView`、`ResultPanel`、`GameBootstrap`。这些文件可以使用 `cc` 模块、节点、组件、事件和资源。

## 模块通信方式

UI 接收玩家输入后调用游戏状态服务。游戏状态服务调用核心算法并产出明确结果，例如选中、消除成功、无效选择、胜利、超时或死局。视图层订阅或接收这些结果后更新节点显示、连接线和结算界面。

推荐使用显式方法调用和轻量事件分发，不让任意组件直接修改棋盘数据。核心数据的唯一写入口应收敛到游戏状态模块。

## 为什么不把全部逻辑写在一个组件里

单组件会把规则、显示、输入、计时和存储耦合在一起，导致寻路和死局检测难以测试，难度配置容易散落，后续适配 Web Mobile 和微信小游戏时也难以拆分。分层后，核心算法可以独立验证，Cocos 组件只负责表现，修改界面不会影响规则正确性。
