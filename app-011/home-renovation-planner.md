# 家装材料用量与点位规划器 · Home Renovation Planner

> 类型：前端 Web 应用｜难度：★★☆｜建议技术栈：React + TypeScript + Vite + SVG + Zustand

## 1. 一句话简介
画出自家户型轮廓，标门窗和家具，自动算出墙漆、壁纸、地板、瓷砖、踢脚线的用量与预算，并导出插座开关点位图给水电工。

## 2. 真实场景与痛点
- 装修买料被「按平方报价」绕晕：到底要几桶漆、几卷壁纸、多少平地板、损耗几个点？
- 水电交底时业主全靠嘴说「这里加个插座」，师傅听漏了就砸墙返工。
- 壁纸要「对花」，窗帘要「褶皱倍数」，这些折算没人帮算。

## 3. 目标用户
- 自装/半包的业主、小装修队工长、出租房改造房东。

## 4. 核心功能（MVP）
1. **画房间**：拖拽/点击绘制多边形墙线（吸附正交与 15° 增量），输入层高，支持多个房间。
2. **门窗开洞**：墙上放门、窗、推拉门，扣减对应面积；标注垭口/飘窗。
3. **铺装分区**：给每个房间指定地面材质（地板/瓷砖）与墙面材质（乳胶漆/壁纸/瓷砖）。
4. **用量计算**：
   - 乳胶漆：`(周长×层高 - 门窗面积) × 涂刷遍数 ÷ 单桶覆盖面积`，天花板可选；给出底漆/面漆桶数。
   - 瓷砖/地板：面积 × (1 + 损耗率)，瓷砖按 800×800 等规格换算块数，并提示「按块买」数量。
   - 壁纸：按卷宽 0.53m × 长 10m 计算，支持对花错位损耗系数。
   - 踢脚线：按扣除门洞的延长米计算。
5. **点位标注**：墙面展开图上拖入插座/开关/网口/灯位，标注高度（距地 mm）、回路，统计总数。
6. **导出**：材料清单（可填单价 → 总价）、施工点位图（按房间分页 PDF）。

## 5. 进阶功能
- 插座回路负载粗算（同回路功率累加给出预警）。
- 开关与灯的多控关系连线（双控/三控）。
- 预算超支对比条、不同品牌/规格方案的比价表。
- 直接从手机相册导入户型图作底图描摹。

## 6. 页面结构
```
/               方案列表
/plan/:id       平面绘制（房间 / 门窗 / 地面分区）
/plan/:id/walls 墙面展开与点位标注
/plan/:id/bom   材料清单与预算
/plan/:id/print 导出视图
```

## 7. 数据模型
```ts
type Room   = { id: string; name: string; polygon: Pt[]; heightMm: number; floorMat: MatId; wallMat: MatId };
type Opening= { id: string; roomId: string; wallIndex: number; offsetMm: number; widthMm: number; heightMm: number; type:'door'|'window'|'arch' };
type Outlet = { id: string; wallKey: string; xMm: number; heightMm: number; kind:'socket'|'switch'|'net'|'light'|'water'; circuit?: string };
type MatSpec= { id: string; name: string; unit:'m2'|'m'|'kg'|'roll'|'pcs'; coverage?: number; lossRate: number; price: number };
```

## 8. 关键算法
- 多边形面积用鞋带公式；周长累加各边长度，墙体中线与净尺寸偏差在 UI 上显式提示（省得跟师傅吵架）。
- 瓷砖块数 = `ceil(面积/单块面积) + 裁切余量`，并对「窄条 < 1/3 砖」给出排版建议。
- 周长减法扣门窗时按墙段索引精确定位，避免「扣重了」。

## 9. 交互与视觉要点
- 工程图纸风：浅灰底 + 蓝色尺寸标注线 + 中文材料图例；尺寸双击可编辑。
- 拖拽吸附时显示「1200mm」实时浮标和参考虚线。
- 顶部常驻面积/周长/预算汇总条；材料表可一键复制成 Word 表格文本。

## 10. 验收标准
- 30 个房间的户型和 200 个点位下，编辑操作无可感延迟（SVG 局部重绘）。
- 材料用量与人工核对误差 ≤ 2%（瓷砖按块计算必须一致）。
- 导出 PDF 带尺寸标注，A3 打印比例 1:50 正确。

## 11. 边界（刻意不做）
不做家具 3D 渲染/效果图，不做装修公司报价与合同流程，不做在线商城选建材下单——避开黑名单中的截图标注、电商订单方向。

## 12. 容器化与构建（Docker）

本项目交付**必须能通过 Docker 构建与运行**，验收一律以容器内运行结果为准。

- **Dockerfile（多阶段）**
  - `builder`：`node:20-alpine` → `npm ci` → `npm run build`，产物 `dist/`
  - `runtime`：`nginx:1.27-alpine`，仅拷贝 `dist/` 与 `nginx.conf`
- **docker-compose.yml**：服务名 `app-011`，端口 `8091:80`，`restart: unless-stopped`
- **nginx.conf**
  - SPA 回退：`try_files $uri $uri/ /index.html`
  - 静态资源长缓存 `immutable`；`index.html` 不缓存；开启 gzip
  - PDF/PNG 导出在浏览器端生成，无需额外服务；如后续增加导出服务需单独容器，不与静态站混装
- **健康检查**：`HEALTHCHECK` 请求 `/healthz`
- **打印验收**：容器部署后 `@media print` 与 A3 1:50 输出仍正确（不依赖本机预览环境）

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

- **验收**：`http://localhost:8091` 可用；30 房间 + 200 点位编辑无可感延迟；材料用量误差 ≤ 2%；镜像体积 < 60MB。
