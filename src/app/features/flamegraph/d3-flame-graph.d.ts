declare module 'd3-flame-graph' {
  export interface FlameGraphDatum {
    name: string;
    value: number;
    children?: FlameGraphDatum[];
  }

  export interface FlameGraphHierarchyNode {
    data: FlameGraphDatum;
    parent: FlameGraphHierarchyNode | null;
    children?: FlameGraphHierarchyNode[];
    x1: number;
    x2: number;
  }

  export interface FlameGraphChart {
    (selection: unknown): void;
    width(w: number): FlameGraphChart;
    height(h: number): FlameGraphChart;
    cellHeight(h: number): FlameGraphChart;
    transitionDuration(ms: number): FlameGraphChart;
    minFrameSize(px: number): FlameGraphChart;
    inverted(v: boolean): FlameGraphChart;
    selfValue(v: boolean): FlameGraphChart;
    title(t: string): FlameGraphChart;
    onClick(cb: (node: FlameGraphHierarchyNode) => void): FlameGraphChart;
    setColorMapper(cb: (node: FlameGraphHierarchyNode, originalColor: string) => string): FlameGraphChart;
    setLabelHandler(cb: (node: FlameGraphHierarchyNode) => string): FlameGraphChart;
    setDetailsElement(el: Element | null): FlameGraphChart;
    search(term: string): void;
    clear(): void;
    resetZoom(): void;
    zoomTo(node: FlameGraphHierarchyNode): void;
    update(data?: FlameGraphDatum): void;
    destroy(): void;
  }

  export default function flamegraph(): FlameGraphChart;
  export function colorMapper(cb: (node: FlameGraphHierarchyNode) => string): (node: FlameGraphHierarchyNode) => string;
  export function tooltip(): unknown;
}
