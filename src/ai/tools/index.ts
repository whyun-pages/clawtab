import { searchSiteTool } from './search-site.tool';
import { tabOpenInBackgroundTool } from './tab.tool';
import {
  tabSnapshotGetTool,
  tabSnapshotListBasicTool,
} from './tab-snapshot.tool';
export enum ToolName {
  TabSnapshotListBasicTool = 'tabSnapshotListBasicTool',
  TabSnapshotGet = 'tabSnapshotGet',
  TabOpenInBackground = 'tabOpenInBackground',
  SearchSite = 'searchSite',
}
export const gatewayTools = {
  [ToolName.TabSnapshotListBasicTool]: tabSnapshotListBasicTool,
  [ToolName.TabSnapshotGet]: tabSnapshotGetTool,
  [ToolName.TabOpenInBackground]: tabOpenInBackgroundTool,
  [ToolName.SearchSite]: searchSiteTool,
};
export type GatewayTools = typeof gatewayTools;
