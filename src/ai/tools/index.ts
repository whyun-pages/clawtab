import { tabOpenInBackgroundTool } from './tab.tool';
import {
  tabSnapshotGetTool,
  tabSnapshotListBasicTool,
} from './tab-snapshot.tool';
export enum ToolName {
  TabSnapshotListBasicTool = 'tabSnapshotListBasicTool',
  TabSnapshotGet = 'tabSnapshotGet',
  TabOpenInBackground = 'tabOpenInBackground',
}
export const gatewayTools = {
  [ToolName.TabSnapshotListBasicTool]: tabSnapshotListBasicTool,
  [ToolName.TabSnapshotGet]: tabSnapshotGetTool,
  [ToolName.TabOpenInBackground]: tabOpenInBackgroundTool,
};
export type GatewayTools = typeof gatewayTools;
