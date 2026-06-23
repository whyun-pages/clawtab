import {
  tabSnapshotGetTool,
  tabSnapshotListBasicTool,
} from './tab-snapshot.tool';
export enum ToolName {
  TabSnapshotListBasicTool = 'tabSnapshotListBasicTool',
  TabSnapshotGet = 'tabSnapshotGet',
}
export const gatewayTools = {
  [ToolName.TabSnapshotListBasicTool]: tabSnapshotListBasicTool,
  [ToolName.TabSnapshotGet]: tabSnapshotGetTool,
};
export type GatewayTools = typeof gatewayTools;
