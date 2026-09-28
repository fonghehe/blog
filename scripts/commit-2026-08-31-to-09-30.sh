#!/usr/bin/env bash
# Publish each article in all five locales in chronological order with local +08:00 commit dates.
# Usage: bash scripts/commit-2026-08-31-to-09-30.sh [--dry-run]
# Rerunning skips groups that have already been committed. Future commit dates are deferred.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ "$(git rev-parse --show-toplevel)" != "$PWD" ]]; then
  echo "Run this script inside its original Git checkout." >&2
  exit 1
fi
if [[ "${1:-}" != "" && "${1:-}" != "--dry-run" ]]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 1
fi
dry_run=false
[[ "${1:-}" == "--dry-run" ]] && dry_run=true

# Final content-count updates belong with the last article, when all locales have 135 posts.
count_paths=(
  README.md README.en.md README.ja.md README.zh-tw.md README.zh-hk.md
  docs/index.md docs/en/index.md docs/ja/index.md docs/zh-tw/index.md docs/zh-hk/index.md
  docs/archive/index.md docs/en/archive/index.md docs/ja/archive/index.md
  docs/zh-tw/archive/index.md docs/zh-hk/archive/index.md
  docs/.vitepress/config.ts docs/.vitepress/rss.ts
  scripts/sync-article-counts.js package.json
)

# Auxiliary files are included only when they currently differ from HEAD.
append_changed_paths() {
  local path
  for path in "$@"; do
    if [[ -n "$(git status --porcelain=v1 -- "$path")" ]]; then
      paths+=("$path")
    fi
  done
}

# Publication date | publication time | commit date | commit time | article slug | Conventional Commit subject.
# All times are Asia/Shanghai (+08:00), and every commit time is after its post.
manifest=$(cat <<'MANIFEST'
2026-09-01|19:08:53|2026-09-01|20:26:31|react-native-appstate-refresh|docs: publish RN app resume refresh in five locales
2026-09-02|16:08:53|2026-09-02|18:47:09|flutter-offline-write-queue|docs: publish Flutter offline write queue guide
2026-09-04|11:37:26|2026-09-04|17:02:44|mobile-screen-state-contract|docs: publish mobile screen state contract
2026-09-07|19:14:42|2026-09-07|20:34:16|react-native-list-performance-diagnosis|docs: publish RN list performance diagnosis
2026-09-09|09:53:14|2026-09-09|16:23:58|flutter-frame-jank-investigation|docs: publish Flutter frame profiling guide
2026-09-11|15:29:08|2026-09-11|18:12:37|mobile-deep-link-security|docs: publish mobile deep link safety guide
2026-09-14|13:06:49|2026-09-14|17:21:03|mobile-session-storage|docs: publish mobile session lifecycle guide
2026-09-16|20:11:35|2026-09-16|20:48:52|react-native-push-inbox-consistency|docs: publish RN push inbox consistency guide
2026-09-18|10:25:57|2026-09-18|15:09:41|flutter-form-async-validation|docs: publish Flutter async form validation guide
2026-09-21|17:46:21|2026-09-21|19:26:04|react-native-native-module-boundary|docs: publish RN native module boundary guide
2026-09-23|12:18:06|2026-09-23|16:42:39|flutter-feature-testing-pyramid|docs: publish Flutter feature testing guide
2026-09-25|18:39:12|2026-09-25|20:17:24|mobile-release-rollout-gates|docs: publish mobile rollout gates guide
2026-09-30|09:32:48|2026-09-30|18:15:36|mobile-accessibility-rn-flutter|docs: publish mobile accessibility acceptance guide
MANIFEST
)

while IFS='|' read -r post_date post_time commit_date commit_time slug subject; do
  [[ -n "$post_date" ]] || continue
  relative_article="posts/${post_date:0:4}/${post_date:5:2}/${slug}.md"
  article="docs/${relative_article}"
  paths=()
  all_in_head=true
  for locale_dir in docs docs/en docs/ja docs/zh-tw docs/zh-hk; do
    localized_article="${locale_dir}/${relative_article}"
    if [[ ! -f "$localized_article" ]]; then
      echo "Missing article: $localized_article" >&2
      exit 1
    fi
    if ! grep -Fqx "date: ${post_date} ${post_time}" "$localized_article"; then
      echo "Publication timestamp mismatch: $localized_article" >&2
      exit 1
    fi
    paths+=("$localized_article")
    if ! git cat-file -e "HEAD:${localized_article}" 2>/dev/null; then
      all_in_head=false
    fi
  done
  node -e '
    const [postDate, published, commitDate, committed] = process.argv.slice(1);
    const pub = Date.parse(`${postDate}T${published}+08:00`);
    const commit = Date.parse(`${commitDate}T${committed}+08:00`);
    if (!(Number.isFinite(pub) && Number.isFinite(commit) && commit > pub)) process.exit(1);
  ' "$post_date" "$post_time" "$commit_date" "$commit_time" || {
    echo "Commit time must be after publication: $article" >&2
    exit 1
  }
  if $all_in_head; then
    echo "Already committed in all five locales: $article"
    continue
  fi
  if [[ "$post_date" == "2026-09-01" ]]; then
    # Remove the previously committed August copy as the September version is published.
    append_changed_paths scripts/commit-2026-08-31-to-09-30.sh docs/posts/2026/08/react-native-appstate-refresh.md
  fi
  if [[ "$post_date" == "2026-09-30" ]]; then
    append_changed_paths "${count_paths[@]}"
  fi
  if [[ -z "$(git status --porcelain=v1 -- "${paths[@]}")" ]]; then
    echo "Already committed: $article"
    continue
  fi
  if ! node -e '
    const [date, time] = process.argv.slice(1);
    process.exit(Date.now() >= Date.parse(`${date}T${time}+08:00`) ? 0 : 1);
  ' "$commit_date" "$commit_time"; then
    echo "Scheduled for later: $article (${commit_date} ${commit_time} +08:00)"
    continue
  fi
  previous_commit_date=$(git log -1 --format='%cI')
  if ! node -e '
    const [date, time, previous] = process.argv.slice(1);
    const commit = Date.parse(`${date}T${time}+08:00`);
    process.exit(commit > Date.parse(previous) ? 0 : 1);
  ' "$commit_date" "$commit_time" "$previous_commit_date"; then
    echo "Commit time must be later than HEAD ($previous_commit_date): $article" >&2
    exit 1
  fi
  if $dry_run; then
    echo "Would commit five locales: $article (${commit_date} ${commit_time} +08:00)"
    continue
  fi
  # Explicit pathspec plus --only protects unrelated staged work.
  git add -- "${paths[@]}"
  git diff --cached --check -- "${paths[@]}"
  GIT_AUTHOR_DATE="${commit_date}T${commit_time}+08:00" \
  GIT_COMMITTER_DATE="${commit_date}T${commit_time}+08:00" \
    git commit --only -m "$subject" -- "${paths[@]}"
  actual_dates=$(git log -1 --format='%aI %cI')
  expected_date="${commit_date}T${commit_time}+08:00"
  if [[ "$actual_dates" != "$expected_date $expected_date" ]]; then
    echo "Commit date verification failed: $actual_dates" >&2
    exit 1
  fi
done <<< "$manifest"
