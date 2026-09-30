#!/usr/bin/env bash
set -euo pipefail

PROFILE="${ORVEN_DSH_PROFILE:-orven-test}"
REPO_URL="${ORVEN_REPO_URL:-https://github.com/Civitasv/orven.git}"
BRANCH="${ORVEN_BRANCH:-master}"
CACHE_ROOT="${ORVEN_LOCAL_ROOT:-${XDG_CACHE_HOME:-$HOME/.cache}/orven-dsh-local}"
SRC_DIR="$CACHE_ROOT/repo"
PACK_DIR="$CACHE_ROOT/packages"
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME_DIR/profiles/$PROFILE"
WORKSPACE_FILE="$PROFILE_DIR/pnpm-workspace.yaml"

BEGIN_MARKER="# >>> orven-local core override"
END_MARKER="# <<< orven-local core override"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

usage() {
  cat <<EOF
Usage:
  $(basename "$0") install        Pull latest Orven, build, pack, and install into DSH
  $(basename "$0") update         Same as install
  $(basename "$0") dump           Show the composed DSH config
  $(basename "$0") run [prompt]   Run DSH with the Orven test profile
  $(basename "$0") uninstall      Remove Orven packages from the test profile
  $(basename "$0") paths          Print local paths

Environment:
  ORVEN_DSH_PROFILE   DSH profile name     (default: orven-test)
  ORVEN_REPO_URL      Git repository       (default: https://github.com/Civitasv/orven.git)
  ORVEN_BRANCH        Git branch           (default: master)
  ORVEN_LOCAL_ROOT    Local cache root     (default: ~/.cache/orven-dsh-local)
  ORVEN_FULL_CHECK=1  Run pnpm check before packaging
  DSH_HOME            DSH home             (default: ~/.dsh)

Typical:
  ./scripts/orven-local.sh install
  ./scripts/orven-local.sh dump
  ./scripts/orven-local.sh run "hello"
EOF
}

sync_repo() {
  mkdir -p "$CACHE_ROOT"

  if [[ ! -d "$SRC_DIR/.git" ]]; then
    echo "==> Cloning Orven"
    git clone "$REPO_URL" "$SRC_DIR"
  else
    echo "==> Updating Orven"
    git -C "$SRC_DIR" fetch origin "$BRANCH"
  fi

  git -C "$SRC_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
  git -C "$SRC_DIR" reset --hard "origin/$BRANCH"

  echo "==> Orven commit: $(git -C "$SRC_DIR" rev-parse --short HEAD)"
}

build_and_pack() {
  echo "==> Installing workspace dependencies"
  pnpm --dir "$SRC_DIR" install --no-frozen-lockfile

  if [[ "${ORVEN_FULL_CHECK:-0}" == "1" ]]; then
    echo "==> Running full checks"
    pnpm --dir "$SRC_DIR" check
  fi

  echo "==> Verifying distributable packages"
  pnpm --dir "$SRC_DIR" distribution:check

  rm -rf "$PACK_DIR"
  mkdir -p "$PACK_DIR"

  echo "==> Packing @orven/core"
  pnpm --dir "$SRC_DIR/packages/core" pack --pack-destination "$PACK_DIR"

  echo "==> Packing @orven/plugin-dsh"
  pnpm --dir "$SRC_DIR/packages/plugin-dsh" pack --pack-destination "$PACK_DIR"

  CORE_TGZ="$(find "$PACK_DIR" -maxdepth 1 -type f -name 'orven-core-*.tgz' | head -n 1)"
  PLUGIN_TGZ="$(find "$PACK_DIR" -maxdepth 1 -type f -name 'orven-plugin-dsh-*.tgz' | head -n 1)"

  [[ -n "$CORE_TGZ" ]] || die "core tarball was not produced"
  [[ -n "$PLUGIN_TGZ" ]] || die "plugin tarball was not produced"

  export CORE_TGZ PLUGIN_TGZ
}

remove_managed_override() {
  [[ -f "$WORKSPACE_FILE" ]] || return 0

  local tmp
  tmp="$(mktemp)"
  awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
    $0 == begin { skip=1; next }
    $0 == end   { skip=0; next }
    !skip       { print }
  ' "$WORKSPACE_FILE" > "$tmp"
  mv "$tmp" "$WORKSPACE_FILE"
}

write_core_override() {
  mkdir -p "$PROFILE_DIR"
  touch "$WORKSPACE_FILE"

  remove_managed_override

  if grep -Eq '^[[:space:]]*overrides:[[:space:]]*$' "$WORKSPACE_FILE"; then
    die "$WORKSPACE_FILE already has an overrides: section not managed by this script.
Use a dedicated profile (default: orven-test), or add:
  '@orven/core': 'file:$CORE_TGZ'
to that existing overrides section manually."
  fi

  cat >> "$WORKSPACE_FILE" <<EOF

$BEGIN_MARKER
overrides:
  '@orven/core': 'file:$CORE_TGZ'
$END_MARKER
EOF
}

install_local() {
  sync_repo
  build_and_pack

  echo "==> Initializing DSH profile and installing @orven/core"
  dsh plugin --profile "$PROFILE" add "$CORE_TGZ"

  echo "==> Pinning plugin dependency to the local packed @orven/core"
  write_core_override

  echo "==> Installing @orven/plugin-dsh"
  dsh plugin --profile "$PROFILE" add "$PLUGIN_TGZ"

  echo
  echo "==> Installed"
  echo "profile : $PROFILE"
  echo "core    : $CORE_TGZ"
  echo "plugin  : $PLUGIN_TGZ"
  echo
  echo "Next:"
  echo "  ./scripts/orven-local.sh dump"
  echo "  ./scripts/orven-local.sh run \"hello\""
}

dump_config() {
  dsh --profile "$PROFILE" --dump-config
}

run_dsh() {
  if [[ "$#" -eq 0 ]]; then
    exec dsh --profile "$PROFILE"
  else
    exec dsh --profile "$PROFILE" "$@"
  fi
}

uninstall_local() {
  echo "==> Removing Orven from DSH profile: $PROFILE"
  dsh plugin --profile "$PROFILE" remove @orven/plugin-dsh @orven/core || true
  remove_managed_override
  echo "==> Done"
}

print_paths() {
  cat <<EOF
repo:       $SRC_DIR
packages:   $PACK_DIR
dsh home:   $DSH_HOME_DIR
profile:    $PROFILE_DIR
workspace:  $WORKSPACE_FILE
EOF
}

main() {
  need git
  need pnpm
  need dsh

  case "${1:-install}" in
    install|update)
      install_local
      ;;
    dump)
      dump_config
      ;;
    run)
      shift
      run_dsh "$@"
      ;;
    uninstall)
      uninstall_local
      ;;
    paths)
      print_paths
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
