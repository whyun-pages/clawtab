import {
  tabSnapshotGetTool,
  tabSnapshotListIdsTool,
} from './tab-snapshot.tool';
export enum ToolName {
  TabSnapshotListIds = 'tabSnapshotListIds',
  TabSnapshotGet = 'tabSnapshotGet',
}
export const gatewayTools = {
  [ToolName.TabSnapshotListIds]: tabSnapshotListIdsTool,
  [ToolName.TabSnapshotGet]: tabSnapshotGetTool,
};
export type GatewayTools = typeof gatewayTools;
