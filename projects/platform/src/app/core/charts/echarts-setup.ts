import * as echarts from 'echarts/core';
import { BarChart, FunnelChart, GaugeChart, LineChart } from 'echarts/charts';
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

/** Treeshaken bundle: only the chart types MarketSpase pages use. */
echarts.use([
  BarChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsCoreOption };
