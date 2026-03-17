import type { CheatsheetTopic } from "./types";

export const git: CheatsheetTopic = {
  id: "git",
  name: "Git",
  categories: [
    {
      name: "Setup & Init",
      items: [
        { command: "git init", description: "Initialize a new repository" },
        { command: "git clone <url>", description: "Clone a remote repository" },
        { command: "git config --global user.name '<name>'", description: "Set global username" },
        { command: "git config --global user.email '<email>'", description: "Set global email" },
      ],
    },
    {
      name: "Staging & Commits",
      items: [
        { command: "git status", description: "Show working tree status" },
        { command: "git add <file>", description: "Stage file" },
        { command: "git add -A", description: "Stage all changes" },
        { command: "git commit -m '<msg>'", description: "Commit with message" },
        { command: "git commit --amend", description: "Amend last commit" },
        { command: "git reset HEAD <file>", description: "Unstage file" },
        { command: "git diff", description: "Show unstaged changes" },
        { command: "git diff --staged", description: "Show staged changes" },
      ],
    },
    {
      name: "Branching",
      items: [
        { command: "git branch", description: "List branches" },
        { command: "git branch <name>", description: "Create branch" },
        { command: "git checkout -b <name>", description: "Create and switch to branch" },
        { command: "git switch <name>", description: "Switch branch" },
        { command: "git branch -d <name>", description: "Delete branch" },
        { command: "git merge <branch>", description: "Merge branch into current" },
      ],
    },
    {
      name: "Remote",
      items: [
        { command: "git remote -v", description: "List remotes" },
        { command: "git remote add <name> <url>", description: "Add remote" },
        { command: "git fetch", description: "Fetch from remote" },
        { command: "git pull", description: "Fetch and merge" },
        { command: "git push", description: "Push to remote" },
        { command: "git push -u origin <branch>", description: "Push and set upstream" },
        { command: "git push --force-with-lease", description: "Force push safely" },
      ],
    },
    {
      name: "Log & History",
      items: [
        { command: "git log --oneline", description: "Compact log" },
        { command: "git log --graph --oneline", description: "Graph log" },
        { command: "git log -p <file>", description: "File change history" },
        { command: "git blame <file>", description: "Line-by-line author info" },
        { command: "git show <commit>", description: "Show commit details" },
        { command: "git reflog", description: "Reference log (undo helper)" },
      ],
    },
    {
      name: "Rebase & Cherry-pick",
      items: [
        { command: "git rebase <branch>", description: "Rebase onto branch" },
        { command: "git rebase -i HEAD~<n>", description: "Interactive rebase last n commits" },
        { command: "git rebase --continue", description: "Continue after conflict" },
        { command: "git rebase --abort", description: "Abort rebase" },
        { command: "git cherry-pick <commit>", description: "Apply commit to current branch" },
      ],
    },
    {
      name: "Stash",
      items: [
        { command: "git stash", description: "Stash working changes" },
        { command: "git stash pop", description: "Apply and remove last stash" },
        { command: "git stash list", description: "List stashes" },
        { command: "git stash drop", description: "Delete last stash" },
        { command: "git stash apply", description: "Apply without removing" },
      ],
    },
  ],
};
