export interface CheatsheetItem {
  command: string;
  description: string;
}

export interface CheatsheetCategory {
  name: string;
  items: CheatsheetItem[];
}

export interface CheatsheetTopic {
  id: string;
  name: string;
  categories: CheatsheetCategory[];
}
