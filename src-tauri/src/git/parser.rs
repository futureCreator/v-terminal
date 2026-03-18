use crate::git::{FileStatus, GitFileEntry, GitStatusResult};

/// Parse output of `git status --porcelain`
pub fn parse_status(output: &str) -> GitStatusResult {
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();

    for line in output.lines() {
        if line.len() < 4 {
            continue;
        }

        let index_status = line.as_bytes()[0];
        let worktree_status = line.as_bytes()[1];
        let path_part = &line[3..];

        // Handle rename: "old -> new"
        let path = if let Some(arrow_pos) = path_part.find(" -> ") {
            path_part[arrow_pos + 4..].to_string()
        } else {
            path_part.to_string()
        };

        // Untracked files: "??"
        if index_status == b'?' && worktree_status == b'?' {
            unstaged.push(GitFileEntry {
                path,
                status: FileStatus::Untracked,
            });
            continue;
        }

        // Staged changes (index column)
        if index_status != b' ' && index_status != b'?' {
            staged.push(GitFileEntry {
                path: path.clone(),
                status: char_to_status(index_status),
            });
        }

        // Unstaged changes (worktree column)
        if worktree_status != b' ' && worktree_status != b'?' {
            unstaged.push(GitFileEntry {
                path,
                status: char_to_status(worktree_status),
            });
        }
    }

    GitStatusResult {
        staged,
        unstaged,
        is_git_repo: true,
    }
}

fn char_to_status(c: u8) -> FileStatus {
    match c {
        b'M' => FileStatus::Modified,
        b'A' => FileStatus::Added,
        b'D' => FileStatus::Deleted,
        b'R' => FileStatus::Renamed,
        _ => FileStatus::Modified, // fallback
    }
}

/// Check if a diff output indicates a binary file
pub fn is_binary_diff(diff_output: &str) -> bool {
    diff_output.contains("Binary files") && diff_output.contains("differ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::FileStatus;

    #[test]
    fn test_parse_status_modified_staged() {
        let output = "M  src/main.rs\n";
        let result = parse_status(output);
        assert!(result.is_git_repo);
        assert_eq!(result.staged.len(), 1);
        assert_eq!(result.staged[0].path, "src/main.rs");
        assert_eq!(result.staged[0].status, FileStatus::Modified);
        assert!(result.unstaged.is_empty());
    }

    #[test]
    fn test_parse_status_modified_unstaged() {
        let output = " M src/main.rs\n";
        let result = parse_status(output);
        assert!(result.is_git_repo);
        assert!(result.staged.is_empty());
        assert_eq!(result.unstaged.len(), 1);
        assert_eq!(result.unstaged[0].path, "src/main.rs");
        assert_eq!(result.unstaged[0].status, FileStatus::Modified);
    }

    #[test]
    fn test_parse_status_both_staged_and_unstaged() {
        let output = "MM src/lib.rs\n";
        let result = parse_status(output);
        assert_eq!(result.staged.len(), 1);
        assert_eq!(result.unstaged.len(), 1);
    }

    #[test]
    fn test_parse_status_added() {
        let output = "A  new_file.rs\n";
        let result = parse_status(output);
        assert_eq!(result.staged[0].status, FileStatus::Added);
    }

    #[test]
    fn test_parse_status_deleted() {
        let output = " D old_file.rs\n";
        let result = parse_status(output);
        assert_eq!(result.unstaged[0].status, FileStatus::Deleted);
    }

    #[test]
    fn test_parse_status_renamed() {
        let output = "R  old.rs -> new.rs\n";
        let result = parse_status(output);
        assert_eq!(result.staged[0].status, FileStatus::Renamed);
        assert_eq!(result.staged[0].path, "new.rs");
    }

    #[test]
    fn test_parse_status_untracked() {
        let output = "?? untracked.txt\n";
        let result = parse_status(output);
        assert_eq!(result.unstaged.len(), 1);
        assert_eq!(result.unstaged[0].status, FileStatus::Untracked);
    }

    #[test]
    fn test_parse_status_empty() {
        let result = parse_status("");
        assert!(result.is_git_repo);
        assert!(result.staged.is_empty());
        assert!(result.unstaged.is_empty());
    }

    #[test]
    fn test_parse_status_multiple_files() {
        let output = "M  staged.rs\n M unstaged.rs\nA  added.rs\n?? untracked.rs\n";
        let result = parse_status(output);
        assert_eq!(result.staged.len(), 2);
        assert_eq!(result.unstaged.len(), 2);
    }

    #[test]
    fn test_is_binary_diff() {
        assert!(is_binary_diff("Binary files /dev/null and b/image.png differ\n"));
        assert!(is_binary_diff("Binary files a/old.bin and b/new.bin differ\n"));
        assert!(!is_binary_diff("--- a/file.rs\n+++ b/file.rs\n"));
    }
}
