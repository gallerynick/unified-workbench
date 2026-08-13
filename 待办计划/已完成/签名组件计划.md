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
- 测试覆盖率目标：80%行覆盖率（使用npx jest --coverage测量）
- 性能验证：60fps下绘制1000个点（使用Performance API的performance.now()测量平均帧时间<=16.67ms）
- 兼容性验证：Chrome 55+, Firefox 59+, Safari 13+（通过Pointer Events Polyfill降级方案确保）
- 可访问性验证：WCAG 2.1 AA级别基本要求（ARIA标签、键盘导航、屏幕阅读器支持）

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1: 基础架构和依赖安装**（Todo 1-4，并行执行）
- Todo 1: 安装signature_pad和react-signature-pad-wrapper依赖，创建目录结构
- Todo 2: 验证signature_pad压力感应API（含iOS Scribble兼容性）
- Todo 3: 创建TypeScript类型定义
- Todo 4: 实现Canvas绘图组件（基于signature_pad）

**Wave 2: 核心绘图引擎实现**（Todo 5-8，并行执行）
- Todo 5: 实现Pointer Events事件处理
- Todo 6: 实现Mouse/Touch降级方案（含Polyfill可靠性验证）
- Todo 7: 实现传统签名模式
- Todo 8: 实现压力感应签名模式

**Wave 3: 压力感应和模式切换**（Todo 9-12，部分并行）
- Todo 9: 实现设备类型自动检测（并行with Todo 10）
- Todo 10: 实现模式切换逻辑（并行with Todo 9）
- Todo 11: 实现撤销/重做功能（依赖Todo 9, 10）
- Todo 12: 实现清除画布功能（依赖Todo 9, 10）

**Wave 4: UI组件和集成**（Todo 13-16，部分并行）
- Todo 13: 实现工具栏组件（并行with Todo 14）
- Todo 14: 实现数据导出功能（并行with Todo 13）
- Todo 15: 实现深浅色模式适配（依赖Todo 13, 14）
- Todo 16: 实现响应式设计（依赖Todo 13, 14）

**Wave 5: 测试和优化**（Todo 17-20，串行执行）
- Todo 17: 编写单元测试
- Todo 18: 编写集成测试
- Todo 19: 性能优化（使用Performance API测量60fps）
- Todo 20: 无障碍访问优化

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
- [x] 1. 安装依赖和创建目录结构
  What to do / Must NOT do: 安装signature_pad和react-signature-pad-wrapper依赖，创建组件目录结构（index.tsx, SignatureCanvas.tsx, SignatureToolbar.tsx, hooks/, types.ts, utils.ts）
  Parallelization: Wave 1 | Blocked by: 无 | Blocks: 2, 3, 4
  References (executor has NO interview context - be exhaustive): 项目文件/frontend/package.json（当前依赖列表）, 项目文件/frontend/src/components/（现有组件结构参考）, 草稿 .omo/drafts/signature-component.md:17-19（组件结构设计）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npm list signature_pad react-signature-pad-wrapper 2>/dev/null | grep -q "signature_pad" && ls src/components/SignaturePad/ | grep -q "index.tsx" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - bash: npm list signature_pad react-signature-pad-wrapper && ls src/components/SignaturePad/index.tsx src/components/SignaturePad/types.ts | wc -l | grep -q "2"（预期：依赖版本显示，2个文件存在）；failure - bash: npm install nonexistent-package（预期：npm error日志）
  Evidence: .omo/evidence/task-1-signature-component.txt
  Commit: Y | feat(signature): 安装签名组件依赖和创建目录结构

- [x] 2. 验证signature_pad压力感应支持
  What to do / Must NOT do: 验证signature_pad库的压力感应API，确保支持自定义压力映射。创建验证测试文件，测试pressure属性在鼠标/触控板/数位板输入下的行为。同时验证iOS Safari的Scribble兼容性。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5, 6
  References (executor has NO interview context - be exhaustive): signature_pad v4.x API文档 https://github.com/szimek/signature_pad（压力感应相关API）, 草稿 .omo/drafts/signature-component.md:129-134（压力感应API假设）, Metis风险：iOS Scribble兼容性（.omo/drafts/signature-component.md:140）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=signature-pad-pressure.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 运行signature-pad-pressure.test.tsx，验证pressure属性返回0-1范围值，验证VelocityPressureBehavior配置生效（预期：测试输出"Tests: 1 passed"）；failure - jest: 故意传入无效pressure值，验证错误处理（预期：测试输出"Tests: 1 failed"，错误信息包含"pressure"）
  Evidence: .omo/evidence/task-2-signature-component.txt
  Commit: Y | test(signature): 验证signature_pad压力感应支持和iOS兼容性

- [x] 3. 创建类型定义
  What to do / Must NOT do: 创建TypeScript类型定义，包括SignaturePadProps、SignatureData、SignaturePath、SignaturePoint等接口。参考草稿中的组件接口设计。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5, 6, 7, 8
  References (executor has NO interview context - be exhaustive): 草稿 .omo/drafts/signature-component.md:21-65（完整组件接口设计：SignaturePadProps、SignatureData、SignaturePath、SignaturePoint）, 项目文件/frontend/tsconfig.json（TypeScript配置）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx tsc --noEmit src/components/SignaturePad/types.ts 2>&1 | grep -q "error" && echo "FAIL" || echo "PASS"
  QA scenarios (name the exact tool + invocation): happy - bash: npx tsc --noEmit src/components/SignaturePad/types.ts（预期：无输出，退出码0）；failure - 故意在types.ts中引入类型错误，验证tsc报错（预期：输出包含"error TS"）
  Evidence: .omo/evidence/task-3-signature-component.txt
  Commit: Y | feat(signature): 创建签名组件类型定义

- [x] 4. 实现Canvas绘图组件
  What to do / Must NOT do: 实现基于signature_pad的Canvas绘图组件SignatureCanvas.tsx，支持高DPI屏幕（devicePixelRatio），使用signature_pad的VelocityPressureBehavior配置。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5, 6, 7, 8
  References (executor has NO interview context - be exhaustive): signature_pad v4.x文档 https://github.com/szimek/signature_pad（SignaturePad构造函数、VelocityPressureBehavior）, 草稿 .omo/drafts/signature-component.md:117-124（Canvas配置、事件处理）, 项目文件/frontend/src/components/TopologyManagement/TopologyCanvas.tsx:200-350（现有Canvas参考实现）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=SignatureCanvas.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 运行SignatureCanvas.test.tsx，验证Canvas元素存在、signature_pad实例创建、高DPI处理（预期："Tests: 3 passed"）；failure - jest: 验证未签名时isEmpty返回true（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-4-signature-component.txt
  Commit: Y | feat(signature): 实现Canvas绘图组件

- [x] 5. 实现Pointer Events事件处理
  What to do / Must NOT do: 实现Pointer Events API事件处理，支持pressure属性和pointerType检测。使用setPointerCapture确保事件连续性。
  Parallelization: Wave 2 | Blocked by: 2, 3, 4 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): MDN Pointer Events API https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events（pressure属性、pointerType属性、setPointerCapture）, 草稿 .omo/drafts/signature-component.md:125-128（事件处理设计）, signature_pad源码中的Pointer Events处理逻辑
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=PointerEvents.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 模拟pointerdown/pointermove/pointerup事件，验证pressure属性被捕获，pointerType正确识别（预期："Tests: 3 passed"）；failure - jest: 模拟不支持Pointer Events的环境，验证降级触发（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-5-signature-component.txt
  Commit: Y | feat(signature): 实现Pointer Events事件处理

- [x] 6. 实现Mouse/Touch降级方案
  What to do / Must NOT do: 实现Mouse和Touch事件降级方案，在不支持Pointer Events的浏览器中确保功能正常。验证Pointer Events Polyfill在Chrome 55+中的可靠性。
  Parallelization: Wave 2 | Blocked by: 2, 3, 4 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): MDN MouseEvent https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent, MDN TouchEvent https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent, 草稿 .omo/drafts/signature-component.md:139（Polyfill假设）, Metis风险：Pointer Events Polyfill可靠性（.omo/drafts/signature-component.md:141）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=MouseTouchFallback.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 模拟mousedown/mousemove/mouseup事件，验证绘图功能正常；模拟touchstart/touchmove/touchend事件，验证触屏支持（预期："Tests: 4 passed"）；failure - jest: 验证PointerEvent不可用时自动降级到MouseEvent（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-6-signature-component.txt
  Commit: Y | feat(signature): 实现Mouse/Touch事件降级方案

- [x] 7. 实现传统签名模式
  What to do / Must NOT do: 实现传统签名模式（鼠标按下并拖动），线条粗细固定。确保mousedown开始绘制、mousemove绘制线条、mouseup结束绘制的完整流程。
  Parallelization: Wave 2 | Blocked by: 3, 4 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): 草稿 .omo/drafts/signature-component.md:86-93（传统签名模式设计）, signature_pad API：beginStroke/strokeMoveTo/endStroke
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=TraditionalMode.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 模拟mousedown→mousemove(10步)→mouseup，验证SignatureData.points.length > 0，验证线条粗细固定（预期："Tests: 3 passed"）；failure - jest: 验证未按下时移动不产生线条（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-7-signature-component.txt
  Commit: Y | feat(signature): 实现传统签名模式

- [x] 8. 实现压力感应签名模式
  What to do / Must NOT do: 实现压力感应签名模式（移动即签名，压力控制粗细），使用VelocityPressureBehavior。确保压力值0-1映射到minWidth-maxWidth。
  Parallelization: Wave 2 | Blocked by: 2, 3, 4 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): 草稿 .omo/drafts/signature-component.md:94-108（压力感应模式设计）, signature_pad VelocityPressureBehavior配置, 草稿 .omo/drafts/signature-component.md:21-65（SignaturePoint.pressure字段）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=PressureMode.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 模拟pressure=0.1和pressure=0.9的pointermove事件，验证线条粗细差异（细线vs粗线），验证移动即绘制（无需按下）（预期："Tests: 3 passed"）；failure - jest: 验证pressure=0时使用minWidth（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-8-signature-component.txt
  Commit: Y | feat(signature): 实现压力感应签名模式

- [x] 9. 实现设备类型自动检测
  What to do / Must NOT do: 实现设备类型自动检测，通过pointerType属性识别mouse/touch/pen，自动切换到对应模式。添加设备检测fallback和用户确认机制。
  Parallelization: Wave 3 | Blocked by: 5, 6, 7, 8 | Blocks: 11, 12
  References (executor has NO interview context - be exhaustive): MDN PointerEvent.pointerType https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerType, 草稿 .omo/drafts/signature-component.md:109-116（自动检测模式设计）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=DeviceDetection.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 模拟pointerType="mouse"事件，验证自动切换到传统模式；模拟pointerType="pen"事件，验证自动切换到压力感应模式（预期："Tests: 3 passed"）；failure - jest: 验证未知pointerType时fallback到传统模式（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-9-signature-component.txt
  Commit: Y | feat(signature): 实现设备类型自动检测

- [x] 10. 实现模式切换逻辑
  What to do / Must NOT do: 实现手动模式切换逻辑，支持传统模式和压力感应模式切换。切换时保留已有签名数据，切换后立即生效。
  Parallelization: Wave 3 | Blocked by: 5, 6, 7, 8 | Blocks: 11, 12
  References (executor has NO interview context - be exhaustive): 草稿 .omo/drafts/signature-component.md:109-116（模式切换设计）, SignaturePadProps.mode属性定义
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=ModeSwitch.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 设置mode="traditional"→绘制→切换mode="pressure"→绘制，验证两种模式的签名数据都存在，验证onModeChange回调被调用（预期："Tests: 3 passed"）；failure - jest: 验证切换模式时不会清除已有签名（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-10-signature-component.txt
  Commit: Y | feat(signature): 实现模式切换逻辑

- [x] 11. 实现撤销/重做功能
  What to do / Must NOT do: 实现撤销/重做功能，支持最多50步历史记录。使用栈数据结构管理历史状态。
  Parallelization: Wave 3 | Blocked by: 9, 10 | Blocks: 13, 14
  References (executor has NO interview context - be exhaustive): 草稿 .omo/drafts/signature-component.md:32（撤销/重做功能）, signature_pad undo()/clear() API
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=UndoRedo.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 绘制3笔→撤销3次→验证isEmpty=true→重做3次→验证签名数据恢复，验证历史记录不超过50步（预期："Tests: 4 passed"）；failure - jest: 验证撤销到空状态时isEmpty=true（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-11-signature-component.txt
  Commit: Y | feat(signature): 实现撤销/重做功能

- [x] 12. 实现清除画布功能
  What to do / Must NOT do: 实现清除画布功能，重置签名状态，调用signature_pad.clear()，触发onSignatureChange回调。
  Parallelization: Wave 3 | Blocked by: 9, 10 | Blocks: 13, 14
  References (executor has NO interview context - be exhaustive): signature_pad.clear() API, 草稿 .omo/drafts/signature-component.md:31（清除功能）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=ClearCanvas.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 绘制签名→调用clear()→验证isEmpty=true，验证onSignatureChange回调被调用且data.isEmpty=true（预期："Tests: 2 passed"）；failure - jest: 验证清除后Canvas尺寸不变（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-12-signature-component.txt
  Commit: Y | feat(signature): 实现清除画布功能

- [x] 13. 实现工具栏组件
  What to do / Must NOT do: 实现工具栏组件SignatureToolbar.tsx，包含清除、撤销、重做、模式切换按钮。使用Ant Design Button组件，适配深浅色模式。
  Parallelization: Wave 4 | Blocked by: 11, 12 | Blocks: 15, 16
  References (executor has NO interview context - be exhaustive): Ant Design Button文档 https://ant.design/components/button, 项目文件/frontend/src/components/（现有组件样式参考）, 草稿 .omo/drafts/signature-component.md:36（工具栏功能）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=SignatureToolbar.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 验证4个按钮存在（清除、撤销、重做、模式切换），验证点击清除按钮调用onClear回调，验证模式切换按钮显示当前模式（预期："Tests: 4 passed"）；failure - jest: 验证disabled状态下按钮不可点击（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-13-signature-component.txt
  Commit: Y | feat(signature): 实现工具栏组件

- [x] 14. 实现数据导出功能
  What to do / Must NOT do: 实现PNG和JSON数据导出功能。PNG使用canvas.toDataURL('image/png')，JSON使用signature_pad.toData()格式。
  Parallelization: Wave 4 | Blocked by: 11, 12 | Blocks: 15, 16
  References (executor has NO interview context - be exhaustive): canvas.toDataURL() API, signature_pad.toData() API, 草稿 .omo/drafts/signature-component.md:33-34（数据格式设计：SignatureData包含png、json字段）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=DataExport.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 绘制签名→调用toDataURL()→验证返回值以"data:image/png;base64,"开头，调用toData()→验证返回值为数组且包含points字段（预期："Tests: 3 passed"）；failure - jest: 验证空签名时toDataURL()返回空白PNG（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-14-signature-component.txt
  Commit: Y | feat(signature): 实现数据导出功能

- [x] 15. 实现深浅色模式适配
  What to do / Must NOT do: 实现深浅色模式适配，使用项目现有的ThemeContext和CSS变量。工具栏按钮、边框、背景色随主题切换。
  Parallelization: Wave 4 | Blocked by: 13, 14 | Blocks: 17
  References (executor has NO interview context - be exhaustive): 项目文件/frontend/src/contexts/ThemeContext.tsx（主题上下文）, 项目文件/frontend/src/App.css:1-30（CSS变量定义：--background-color, --text-color等）, 草稿 .omo/drafts/signature-component.md:38（深浅色模式）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=ThemeAdaption.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 设置theme="dark"→验证Canvas背景色为深色→切换theme="light"→验证Canvas背景色为浅色（预期："Tests: 2 passed"）；failure - jest: 验证未提供ThemeContext时使用默认主题（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-15-signature-component.txt
  Commit: Y | feat(signature): 实现深浅色模式适配

- [x] 16. 实现响应式设计
  What to do / Must NOT do: 实现响应式设计，Canvas尺寸根据容器宽度自适应，保持宽高比。使用ResizeObserver监听容器尺寸变化。
  Parallelization: Wave 4 | Blocked by: 13, 14 | Blocks: 17
  References (executor has NO interview context - be exhaustive): MDN ResizeObserver https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver, 草稿 .omo/drafts/signature-component.md:39（响应式设计）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=ResponsiveDesign.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 模拟容器宽度从800px变为400px，验证Canvas宽度跟随变化，验证签名数据坐标正确转换（预期："Tests: 3 passed"）；failure - jest: 验证容器宽度为0时不渲染Canvas（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-16-signature-component.txt
  Commit: Y | feat(signature): 实现响应式设计

- [x] 17. 编写单元测试
  What to do / Must NOT do: 编写单元测试，覆盖核心功能（传统模式、压力模式、模式切换、撤销重做、数据导出）。使用Jest + React Testing Library。
  Parallelization: Wave 5 | Blocked by: 15, 16 | Blocks: 18
  References (executor has NO interview context - be exhaustive): Jest文档 https://jestjs.io/docs/api, React Testing Library文档 https://testing-library.com/docs/react-testing-library/intro/, 项目文件/frontend/jest.config.js（测试配置）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --coverage --testPathPattern=SignaturePad 2>&1 | grep -E "Statements|Branches|Functions|Lines" | head -4
  QA scenarios (name the exact tool + invocation): happy - bash: npx jest --coverage（预期：Statements覆盖率>=80%，Branches覆盖率>=70%）；failure - 故意删除一个测试文件，验证覆盖率下降（预期：覆盖率<80%）
  Evidence: .omo/evidence/task-17-signature-component.txt
  Commit: Y | test(signature): 编写单元测试

- [x] 18. 编写集成测试
  What to do / Must NOT do: 编写集成测试，测试组件完整交互流程：渲染→签名→模式切换→撤销→导出→清除。
  Parallelization: Wave 5 | Blocked by: 17 | Blocks: 19
  References (executor has NO interview context - be exhaustive): React Testing Library userEvent文档 https://testing-library.com/docs/user-event/intro/, 草稿 .omo/drafts/signature-component.md:157-164（测试策略）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=SignaturePad.integration.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 完整流程测试（渲染→绘制→切换模式→绘制→撤销→导出PNG→清除），验证每步状态正确（预期："Tests: 6 passed"）；failure - jest: 验证禁用状态下无法签名（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-18-signature-component.txt
  Commit: Y | test(signature): 编写集成测试

- [x] 19. 性能优化
  What to do / Must NOT do: 性能优化，确保60fps下绘制1000个点。使用Performance API测量帧率，使用requestAnimationFrame优化绘图，使用防抖优化onSignatureChange回调。
  Parallelization: Wave 5 | Blocked by: 18 | Blocks: 20
  References (executor has NO interview context - be exhaustive): MDN Performance API https://developer.mozilla.org/en-US/docs/Web/API/Performance, MDN requestAnimationFrame https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame, 草稿 .omo/drafts/signature-component.md:130（性能优化策略）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=Performance.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 模拟1000个pointermove事件（16ms间隔），使用performance.now()测量总时间，验证平均帧时间<=16.67ms（60fps），验证onSignatureChange被防抖调用（预期："Tests: 3 passed"）；failure - jest: 验证无防抖时onSignatureChange被频繁调用（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-19-signature-component.txt
  Commit: Y | perf(signature): 性能优化

- [x] 20. 无障碍访问优化
  What to do / Must NOT do: 无障碍访问优化，添加ARIA标签（role="img"、aria-label）、键盘导航支持（Tab聚焦、Enter清除）、屏幕阅读器提示。
  Parallelization: Wave 5 | Blocked by: 19 | Blocks: 无
  References (executor has NO interview context - be exhaustive): WCAG 2.1 https://www.w3.org/TR/WCAG21/, MDN ARIA https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA, 草稿 .omo/drafts/signature-component.md:37（可访问性要求）
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx jest --testPathPattern=Accessibility.test.tsx 2>&1 | grep -q "Tests:.*passed" && echo "PASS" || echo "FAIL"
  QA scenarios (name the exact tool + invocation): happy - jest: 验证Canvas元素有role="img"和aria-label属性，验证Tab键可以聚焦Canvas，验证Enter键触发清除功能（预期："Tests: 3 passed"）；failure - jest: 验证无ARIA标签时屏幕阅读器无法识别（预期："Tests: 1 passed"）
  Evidence: .omo/evidence/task-20-signature-component.txt
  Commit: Y | a11y(signature): 无障碍访问优化

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
  What to do / Must NOT do: 审查计划合规性，逐项检查Must have和Must NOT have列表
  Acceptance criteria (agent-executable): bash: 检查所有15个Must have功能是否实现，所有13个Must NOT have功能是否未实现
  QA scenarios: happy - 遍历Must have列表，每个功能都有对应测试通过；failure - 发现某个Must have功能未实现或某个Must NOT have功能被实现
  Evidence: .omo/evidence/F1-signature-component.txt

- [x] F2. Code quality review
  What to do / Must NOT do: 代码质量审查，运行ESLint、Prettier、TypeScript检查
  Acceptance criteria (agent-executable): bash: cd 项目文件/frontend && npx eslint src/components/SignaturePad/ && npx prettier --check src/components/SignaturePad/ && npx tsc --noEmit
  QA scenarios: happy - 所有检查通过，无错误输出；failure - 发现ESLint/Prettier/TypeScript错误
  Evidence: .omo/evidence/F2-signature-component.txt

- [x] F3. Real manual QA
  What to do / Must NOT do: 真实手动QA，测试所有功能在目标浏览器中的表现
  Acceptance criteria (agent-executable): 在Chrome 55+、Firefox 59+、Safari 13+中测试传统模式签名、压力感应模式签名、模式切换、撤销重做、数据导出
  QA scenarios: happy - 所有浏览器中所有功能正常工作；failure - 发现某个浏览器中某个功能异常
  Evidence: .omo/evidence/F3-signature-component.txt

- [x] F4. Scope fidelity
  What to do / Must NOT do: 范围保真度审查，确保实现范围与计划范围一致
  Acceptance criteria (agent-executable): 对比Must have列表和实际实现，对比Must NOT have列表和实际代码
  QA scenarios: happy - 实现范围与计划范围完全一致；failure - 发现范围偏差（多实现或少实现）
  Evidence: .omo/evidence/F4-signature-component.txt

## Commit strategy
- 每个todo完成后提交一次
- 提交信息格式：feat(signature): <description> 或 test(signature): <description> 或 perf(signature): <description> 或 a11y(signature): <description>
- 确保每个提交都是原子性的，只包含相关更改
- 在提交前运行lint和类型检查

## Success criteria
1. 功能完整性：所有Must have功能实现，所有Must NOT have功能未实现（通过F1计划合规性审查验证）
2. 性能指标：60fps下绘制1000个点，平均帧时间<=16.67ms（通过Performance API测量）
3. 兼容性：Chrome 55+, Firefox 59+, Safari 13+正常工作（通过Pointer Events Polyfill降级方案确保）
4. 可访问性：满足WCAG 2.1 AA级别基本要求（ARIA标签、键盘导航、屏幕阅读器支持）
5. 测试覆盖率：80%行覆盖率（通过npx jest --coverage测量）
6. 代码质量：ESLint, Prettier检查通过，TypeScript严格模式无错误（通过npx eslint && npx prettier --check测量）
7. 用户体验：两种签名模式正常工作，模式切换流畅（通过集成测试验证）
8. 集成性：与现有项目集成良好，深浅色模式适配正确（通过ThemeAdaption测试验证）
