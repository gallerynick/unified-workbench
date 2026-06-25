# signature-component - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 一个功能完整的网页签名组件，支持两种签名模式：传统模式（鼠标按下并拖动）和压力感应模式（移动即签名，压力控制粗细），可以自动检测输入设备类型，支持撤销/重做、数据导出等功能。

**Why this approach:** 使用成熟的signature_pad库作为核心，结合Pointer Events API实现压力感应，确保兼容性和性能。采用组件化设计，便于维护和扩展。

**What it will NOT do:** 不支持签名识别、多用户协作、签名验证、复杂绘图工具、图层管理、颜色选择、画笔样式选择、签名动画、签名模板、签名批注等功能。SVG导出作为可选功能，签名回放仅支持基本功能。

**Effort:** Medium
**Risk:** Medium - 需要验证signature_pad的压力感应支持和Pointer Events Polyfill的可靠性
**Decisions to sanity-check:** 1) 使用signature_pad库而非从头实现；2) Pointer Events为主，Mouse/Touch为降级方案；3) SVG作为可选功能；4) 自动检测+手动切换模式

Your next move: 批准方案，开始执行计划。Full execution detail follows below.

---

> TL;DR (machine): Medium effort, Medium risk, 签名组件支持传统模式和压力感应模式，基于signature_pad库

## Scope
### Must have
1. Canvas绘图引擎（基于signature_pad库）
2. Pointer Events API事件处理（为主）
3. Mouse/Touch事件降级方案
4. 传统签名模式（鼠标按下并拖动）
5. 压力感应签名模式（移动即签名，压力控制粗细）
6. 自动检测设备类型模式
7. 手动切换模式功能
8. PNG数据导出
9. JSON路径数据导出
10. 撤销/重做功能
11. 清除画布功能
12. 工具栏组件（清除、撤销、重做、模式切换）
13. 基本的ARIA标签和键盘可访问性
14. 响应式设计
15. 深浅色模式适配

### Must NOT have (guardrails, anti-slop, scope boundaries)
1. 不支持签名识别（手写转文字）
2. 不支持多用户协作签名
3. 不支持签名验证（与数据库中的签名比对）
4. 不支持复杂的绘图工具（只支持签名笔触）
5. 不支持图层管理
6. 不支持颜色选择（默认黑色）
7. 不支持画笔样式选择（默认实线）
8. 不支持签名动画效果
9. 不支持签名模板
10. 不支持签名批注功能
11. SVG导出作为可选功能（不在核心范围内）
12. 签名回放功能仅支持基本回放（无播放控制UI）
13. 不支持复杂的设备兼容性矩阵

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + Jest + React Testing Library
- Evidence: .omo/evidence/task-<N>-signature-component.<ext>
- 测试覆盖率目标：80%行覆盖率
- 性能验证：60fps下绘制1000个点
- 兼容性验证：Chrome 55+, Firefox 59+, Safari 13+
- 可访问性验证：WCAG 2.1 AA级别基本要求

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1: 基础架构和依赖安装**
- 安装signature_pad和react-signature-pad-wrapper依赖
- 创建组件目录结构和类型定义
- 验证signature_pad库的压力感应支持

**Wave 2: 核心绘图引擎实现**
- 实现Canvas绘图组件
- 实现Pointer Events事件处理
- 实现Mouse/Touch事件降级方案
- 实现传统签名模式

**Wave 3: 压力感应和模式切换**
- 实现压力感应签名模式
- 实现设备类型自动检测
- 实现模式切换逻辑
- 实现撤销/重做功能

**Wave 4: UI组件和集成**
- 实现工具栏组件
- 实现数据导出功能
- 实现深浅色模式适配
- 实现响应式设计

**Wave 5: 测试和优化**
- 编写单元测试
- 编写集成测试
- 性能优化
- 无障碍访问优化

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. 安装依赖和创建目录结构 | 无 | 2, 3, 4 | 无 |
| 2. 验证signature_pad压力感应 | 1 | 5, 6 | 3, 4 |
| 3. 创建类型定义 | 1 | 5, 6, 7, 8 | 2, 4 |
| 4. 实现Canvas绘图组件 | 1 | 5, 6, 7, 8 | 2, 3 |
| 5. 实现Pointer Events事件处理 | 2, 3, 4 | 9, 10 | 6, 7, 8 |
| 6. 实现Mouse/Touch降级方案 | 2, 3, 4 | 9, 10 | 5, 7, 8 |
| 7. 实现传统签名模式 | 3, 4 | 9, 10 | 5, 6, 8 |
| 8. 实现压力感应签名模式 | 2, 3, 4 | 9, 10 | 5, 6, 7 |
| 9. 实现设备类型自动检测 | 5, 6, 7, 8 | 11, 12 | 10 |
| 10. 实现模式切换逻辑 | 5, 6, 7, 8 | 11, 12 | 9 |
| 11. 实现撤销/重做功能 | 9, 10 | 13, 14 | 12 |
| 12. 实现清除画布功能 | 9, 10 | 13, 14 | 11 |
| 13. 实现工具栏组件 | 11, 12 | 15, 16 | 14 |
| 14. 实现数据导出功能 | 11, 12 | 15, 16 | 13 |
| 15. 实现深浅色模式适配 | 13, 14 | 17 | 16 |
| 16. 实现响应式设计 | 13, 14 | 17 | 15 |
| 17. 编写单元测试 | 15, 16 | 18 | 无 |
| 18. 编写集成测试 | 17 | 19 | 无 |
| 19. 性能优化 | 18 | 20 | 无 |
| 20. 无障碍访问优化 | 19 | 无 | 无 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. 安装依赖和创建目录结构
  What to do / Must NOT do: 安装signature_pad和react-signature-pad-wrapper依赖，创建组件目录结构
  Parallelization: Wave 1 | Blocked by: 无 | Blocks: 2, 3, 4
  References (executor has NO interview context - be exhaustive): package.json, src/components/目录结构
  Acceptance criteria (agent-executable): npm list signature_pad react-signature-pad-wrapper && ls -la src/components/SignaturePad/
  QA scenarios (name the exact tool + invocation): happy - 验证依赖安装成功，目录结构正确；failure - 依赖安装失败，目录创建失败
  Evidence: .omo/evidence/task-1-signature-component.txt
  Commit: Y | feat(signature): 安装签名组件依赖和创建目录结构

- [ ] 2. 验证signature_pad压力感应支持
  What to do / Must NOT do: 验证signature_pad库的压力感应API，确保支持自定义压力映射
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5, 6
  References (executor has NO interview context - be exhaustive): signature_pad文档, https://github.com/szimek/signature_pad
  Acceptance criteria (agent-executable): 编写测试代码验证pressure属性可用性
  QA scenarios (name the exact tool + invocation): happy - 压力感应API工作正常；failure - API不支持或行为异常
  Evidence: .omo/evidence/task-2-signature-component.txt
  Commit: Y | test(signature): 验证signature_pad压力感应支持

- [ ] 3. 创建类型定义
  What to do / Must NOT do: 创建TypeScript类型定义，包括Props、State、Data格式等
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5, 6, 7, 8
  References (executor has NO interview context - be exhaustive): draft文件中的组件接口设计
  Acceptance criteria (agent-executable): tsc --noEmit src/components/SignaturePad/types.ts
  QA scenarios (name the exact tool + invocation): happy - 类型定义正确，无TypeScript错误；failure - 类型定义错误或缺失
  Evidence: .omo/evidence/task-3-signature-component.txt
  Commit: Y | feat(signature): 创建签名组件类型定义

- [ ] 4. 实现Canvas绘图组件
  What to do / Must NOT do: 实现基于signature_pad的Canvas绘图组件，支持高DPI屏幕
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5, 6, 7, 8
  References (executor has NO interview context - be exhaustive): signature_pad文档, Canvas API文档
  Acceptance criteria (agent-executable): 组件渲染正确，支持基本绘图
  QA scenarios (name the exact tool + invocation): happy - Canvas组件渲染正常，可以绘图；failure - 组件渲染失败或无法绘图
  Evidence: .omo/evidence/task-4-signature-component.txt
  Commit: Y | feat(signature): 实现Canvas绘图组件

- [ ] 5. 实现Pointer Events事件处理
  What to do / Must NOT do: 实现Pointer Events API事件处理，支持压力感应
  Parallelization: Wave 2 | Blocked by: 2, 3, 4 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): Pointer Events API文档, MDN文档
  Acceptance criteria (agent-executable): 事件处理正确，支持pressure属性
  QA scenarios (name the exact tool + invocation): happy - Pointer Events工作正常，压力感应可用；failure - 事件处理失败或压力感应不可用
  Evidence: .omo/evidence/task-5-signature-component.txt
  Commit: Y | feat(signature): 实现Pointer Events事件处理

- [ ] 6. 实现Mouse/Touch降级方案
  What to do / Must NOT do: 实现Mouse和Touch事件降级方案，确保兼容性
  Parallelization: Wave 2 | Blocked by: 2, 3, 4 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): Mouse/Touch事件文档
  Acceptance criteria (agent-executable): 在不支持Pointer Events的浏览器中正常工作
  QA scenarios (name the exact tool + invocation): happy - Mouse/Touch事件正常工作；failure - 事件处理失败
  Evidence: .omo/evidence/task-6-signature-component.txt
  Commit: Y | feat(signature): 实现Mouse/Touch事件降级方案

- [ ] 7. 实现传统签名模式
  What to do / Must NOT do: 实现传统签名模式（鼠标按下并拖动）
  Parallelization: Wave 2 | Blocked by: 3, 4 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): 签名模式设计
  Acceptance criteria (agent-executable): 传统模式下可以正常签名
  QA scenarios (name the exact tool + invocation): happy - 传统模式签名正常；failure - 签名模式工作异常
  Evidence: .omo/evidence/task-7-signature-component.txt
  Commit: Y | feat(signature): 实现传统签名模式

- [ ] 8. 实现压力感应签名模式
  What to do / Must NOT do: 实现压力感应签名模式（移动即签名，压力控制粗细）
  Parallelization: Wave 2 | Blocked by: 2, 3, 4 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): 签名模式设计，压力感应API
  Acceptance criteria (agent-executable): 压力感应模式下可以正常签名，压力控制粗细
  QA scenarios (name the exact tool + invocation): happy - 压力感应模式签名正常；failure - 压力感应不工作或粗细控制异常
  Evidence: .omo/evidence/task-8-signature-component.txt
  Commit: Y | feat(signature): 实现压力感应签名模式

- [ ] 9. 实现设备类型自动检测
  What to do / Must NOT do: 实现设备类型自动检测，支持鼠标、触控板、数位板
  Parallelization: Wave 3 | Blocked by: 5, 6, 7, 8 | Blocks: 11, 12
  References (executor has NO interview context - be exhaustive): Pointer Events API, pointerType属性
  Acceptance criteria (agent-executable): 正确检测设备类型，自动切换模式
  QA scenarios (name the exact tool + invocation): happy - 设备检测正确，模式自动切换；failure - 设备检测错误或模式切换失败
  Evidence: .omo/evidence/task-9-signature-component.txt
  Commit: Y | feat(signature): 实现设备类型自动检测

- [ ] 10. 实现模式切换逻辑
  What to do / Must NOT do: 实现手动模式切换逻辑，支持传统模式和压力感应模式切换
  Parallelization: Wave 3 | Blocked by: 5, 6, 7, 8 | Blocks: 11, 12
  References (executor has NO interview context - be exhaustive): 模式切换设计
  Acceptance criteria (agent-executable): 手动切换模式正常工作
  QA scenarios (name the exact tool + invocation): happy - 模式切换正常；failure - 模式切换失败
  Evidence: .omo/evidence/task-10-signature-component.txt
  Commit: Y | feat(signature): 实现模式切换逻辑

- [ ] 11. 实现撤销/重做功能
  What to do / Must NOT do: 实现撤销/重做功能，支持最多50步历史记录
  Parallelization: Wave 3 | Blocked by: 9, 10 | Blocks: 13, 14
  References (executor has NO interview context - be exhaustive): 状态管理设计
  Acceptance criteria (agent-executable): 撤销/重做功能正常工作，历史记录不超过50步
  QA scenarios (name the exact tool + invocation): happy - 撤销/重做正常；failure - 功能异常或历史记录溢出
  Evidence: .omo/evidence/task-11-signature-component.txt
  Commit: Y | feat(signature): 实现撤销/重做功能

- [ ] 12. 实现清除画布功能
  What to do / Must NOT do: 实现清除画布功能，重置签名状态
  Parallelization: Wave 3 | Blocked by: 9, 10 | Blocks: 13, 14
  References (executor has NO interview context - be exhaustive): Canvas API
  Acceptance criteria (agent-executable): 清除功能正常工作，画布重置
  QA scenarios (name the exact tool + invocation): happy - 清除功能正常；failure - 清除失败或状态异常
  Evidence: .omo/evidence/task-12-signature-component.txt
  Commit: Y | feat(signature): 实现清除画布功能

- [ ] 13. 实现工具栏组件
  What to do / Must NOT do: 实现工具栏组件，包含清除、撤销、重做、模式切换按钮
  Parallelization: Wave 4 | Blocked by: 11, 12 | Blocks: 15, 16
  References (executor has NO interview context - be exhaustive): Ant Design组件库
  Acceptance criteria (agent-executable): 工具栏渲染正确，按钮功能正常
  QA scenarios (name the exact tool + invocation): happy - 工具栏正常工作；failure - 工具栏渲染失败或按钮功能异常
  Evidence: .omo/evidence/task-13-signature-component.txt
  Commit: Y | feat(signature): 实现工具栏组件

- [ ] 14. 实现数据导出功能
  What to do / Must NOT do: 实现PNG和JSON数据导出功能
  Parallelization: Wave 4 | Blocked by: 11, 12 | Blocks: 15, 16
  References (executor has NO interview context - be exhaustive): Canvas API, JSON格式设计
  Acceptance criteria (agent-executable): 数据导出正常，格式正确
  QA scenarios (name the exact tool + invocation): happy - 数据导出正常；failure - 导出失败或格式错误
  Evidence: .omo/evidence/task-14-signature-component.txt
  Commit: Y | feat(signature): 实现数据导出功能

- [ ] 15. 实现深浅色模式适配
  What to do / Must NOT do: 实现深浅色模式适配，参考项目现有模式
  Parallelization: Wave 4 | Blocked by: 13, 14 | Blocks: 17
  References (executor has NO interview context - be exhaustive): ThemeContext, CSS变量
  Acceptance criteria (agent-executable): 深浅色模式切换正常，样式适配正确
  QA scenarios (name the exact tool + invocation): happy - 深浅色模式适配正常；failure - 模式切换失败或样式异常
  Evidence: .omo/evidence/task-15-signature-component.txt
  Commit: Y | feat(signature): 实现深浅色模式适配

- [ ] 16. 实现响应式设计
  What to do / Must NOT do: 实现响应式设计，支持不同屏幕尺寸
  Parallelization: Wave 4 | Blocked by: 13, 14 | Blocks: 17
  References (executor has NO interview context - be exhaustive): 响应式设计原则
  Acceptance criteria (agent-executable): 不同屏幕尺寸下布局正常
  QA scenarios (name the exact tool + invocation): happy - 响应式设计正常；failure - 布局异常或功能失效
  Evidence: .omo/evidence/task-16-signature-component.txt
  Commit: Y | feat(signature): 实现响应式设计

- [ ] 17. 编写单元测试
  What to do / Must NOT do: 编写单元测试，覆盖核心功能
  Parallelization: Wave 5 | Blocked by: 15, 16 | Blocks: 18
  References (executor has NO interview context - be exhaustive): Jest, React Testing Library
  Acceptance criteria (agent-executable): 测试覆盖率80%以上
  QA scenarios (name the exact tool + invocation): happy - 测试通过，覆盖率达标；failure - 测试失败或覆盖率不足
  Evidence: .omo/evidence/task-17-signature-component.txt
  Commit: Y | test(signature): 编写单元测试

- [ ] 18. 编写集成测试
  What to do / Must NOT do: 编写集成测试，测试组件交互
  Parallelization: Wave 5 | Blocked by: 17 | Blocks: 19
  References (executor has NO interview context - be exhaustive): 集成测试策略
  Acceptance criteria (agent-executable): 集成测试通过
  QA scenarios (name the exact tool + invocation): happy - 集成测试通过；failure - 集成测试失败
  Evidence: .omo/evidence/task-18-signature-component.txt
  Commit: Y | test(signature): 编写集成测试

- [ ] 19. 性能优化
  What to do / Must NOT do: 性能优化，确保60fps下绘制1000个点
  Parallelization: Wave 5 | Blocked by: 18 | Blocks: 20
  References (executor has NO interview context - be exhaustive): 性能优化策略
  Acceptance criteria (agent-executable): 性能测试通过，满足60fps要求
  QA scenarios (name the exact tool + invocation): happy - 性能测试通过；failure - 性能不达标
  Evidence: .omo/evidence/task-19-signature-component.txt
  Commit: Y | perf(signature): 性能优化

- [ ] 20. 无障碍访问优化
  What to do / Must NOT do: 无障碍访问优化，满足WCAG 2.1 AA级别基本要求
  Parallelization: Wave 5 | Blocked by: 19 | Blocks: 无
  References (executor has NO interview context - be exhaustive): WCAG 2.1, ARIA标签
  Acceptance criteria (agent-executable): 无障碍访问测试通过
  QA scenarios (name the exact tool + invocation): happy - 无障碍访问测试通过；failure - 测试失败
  Evidence: .omo/evidence/task-20-signature-component.txt
  Commit: Y | a11y(signature): 无障碍访问优化

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  What to do / Must NOT do: 审查计划合规性，确保所有功能按计划实现
  Acceptance criteria (agent-executable): 所有Must have功能实现，所有Must NOT have功能未实现
  QA scenarios: happy - 计划合规性审查通过；failure - 发现计划偏差
  Evidence: .omo/evidence/F1-signature-component.txt

- [ ] F2. Code quality review
  What to do / Must NOT do: 代码质量审查，确保代码符合项目规范
  Acceptance criteria (agent-executable): ESLint, Prettier检查通过，TypeScript严格模式无错误
  QA scenarios: happy - 代码质量审查通过；failure - 发现代码质量问题
  Evidence: .omo/evidence/F2-signature-component.txt

- [ ] F3. Real manual QA
  What to do / Must NOT do: 真实手动QA，测试所有功能
  Acceptance criteria (agent-executable): 所有功能在目标浏览器中正常工作
  QA scenarios: happy - 手动QA通过；failure - 发现功能问题
  Evidence: .omo/evidence/F3-signature-component.txt

- [ ] F4. Scope fidelity
  What to do / Must NOT do: 范围保真度审查，确保实现符合范围定义
  Acceptance criteria (agent-executable): 实现范围与计划范围一致
  QA scenarios: happy - 范围保真度审查通过；failure - 发现范围偏差
  Evidence: .omo/evidence/F4-signature-component.txt

## Commit strategy
- 每个todo完成后提交一次
- 提交信息格式：feat(signature): <description> 或 test(signature): <description> 或 perf(signature): <description> 或 a11y(signature): <description>
- 确保每个提交都是原子性的，只包含相关更改
- 在提交前运行lint和类型检查

## Success criteria
1. 功能完整性：所有Must have功能实现，所有Must NOT have功能未实现
2. 性能指标：60fps下绘制1000个点，延迟<16ms
3. 兼容性：Chrome 55+, Firefox 59+, Safari 13+正常工作
4. 可访问性：满足WCAG 2.1 AA级别基本要求
5. 测试覆盖率：80%行覆盖率
6. 代码质量：ESLint, Prettier检查通过，TypeScript严格模式无错误
7. 用户体验：两种签名模式正常工作，模式切换流畅
8. 集成性：与现有项目集成良好，深浅色模式适配正确
