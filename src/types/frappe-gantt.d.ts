declare module "frappe-gantt" {
  export interface GanttTask {
    id: string;
    name: string;
    start: string;
    end: string;
    progress?: number;
    dependencies?: string;
    custom_class?: string;
  }
  export interface GanttOptions {
    header_height?: number;
    column_width?: number;
    bar_height?: number;
    padding?: number;
    view_mode?: string;
    date_format?: string;
    language?: string;
    [key: string]: unknown;
  }
  export default class Gantt {
    constructor(wrapper: HTMLElement | string, tasks: GanttTask[], options?: GanttOptions);
    change_view_mode(mode?: string): void;
    refresh(tasks: GanttTask[]): void;
  }
}
