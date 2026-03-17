export type { CheatsheetTopic, CheatsheetCategory, CheatsheetItem } from "./types";
export { vim } from "./vim";
export { git } from "./git";
export { docker } from "./docker";
export { kubectl } from "./kubectl";

import { vim } from "./vim";
import { git } from "./git";
import { docker } from "./docker";
import { kubectl } from "./kubectl";
import type { CheatsheetTopic } from "./types";

export const allTopics: CheatsheetTopic[] = [vim, git, docker, kubectl];
