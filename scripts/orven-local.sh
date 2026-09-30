#!/usr/bin/env bash
set -euo pipefail

PROFILE="${ORVEN_DSH_PROFILE:-orven}"
TEMPLATE="${ORVEN_DSH_TEMPLATE:-web}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACK_ROOT="${ORVEN_PACK_ROOT:-${XDG_CACHE_HOME:-$HOME/.cache}/orven-dsh-local}"
PACK_DIR="$PACK_ROOT/packages"
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME_DIR/profiles/$PROFILE"
WORKSPACE_FILE="$PROFILE_DIR/pnpm-workspace.yaml"
PROFILE_MARKER="$PROFILE_DIR/.orven-local-profile"

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
  ./scripts/orven-local.sh install          Build the current checkout and install it into DSH
  ./scripts/orven-local.sh update           Rebuild/reinstall the current checkout
  ./scripts/orven-local.sh dump             Show the composed DSH config
  ./scripts/orven-local.sh run [app args]   Run the dedicated Orven DSH profile
  ./scripts/orven-local.sh uninstall        Remove Orven packages but keep the profile
  ./scripts/orven-local.sh reset            Delete the script-managed Orven profile
  ./scripts/orven-local.sh paths            Print local paths

Environment:
  ORVEN_DSH_PROFILE    DSH profile name     (default: orven)
  ORVEN_DSH_TEMPLATE   Initial DSH template (default: web)
  ORVEN_PACK_ROOT      Packed artifact root (default: ~/.cache/orven-dsh-local)
  ORVEN_FULL_CHECK=1   Run full checks/distribution verification before install
  DSH_HOME             DSH home             (default: ~/.dsh)

On first install the script creates the dedicated profile from the selected DSH
template. Later installs reuse that profile. The script never fetches, resets, or
switches Git branches; it always tests the working tree that contains this script.

Typical:
  ./scripts/orven-local.sh install
  ./scripts/orven-local.sh dump
  ./scripts/orven-local.sh run
  ./scripts/orven-local.sh run --no-open
EOF
}

ensure_profile() {
  if [[ -d "$PROFILE_DIR" ]]; then
    echo "==> Using existing DSH profile: $PROFILE"
    return 0
  fi

  echo "==> Initializing DSH profile '$PROFILE' from '$TEMPLATE'"
  dsh --profile "$PROFILE" --from-default-profile "$TEMPLATE" --dump-config >/dev/null

  mkdir -p "$PROFILE_DIR"
  {
    printf 'created-by=orven-local\n'
    printf 'template=%s\n' "$TEMPLATE"
  } > "$PROFILE_MARKER"
}

require_profile() {
  [[ -d "$PROFILE_DIR" ]] || die "DSH profile '$PROFILE' does not exist. Run ./scripts/orven-local.sh install first."
}

reset_profile() {
  if [[ ! -d "$PROFILE_DIR" ]]; then
    echo "==> DSH profile '$PROFILE' is already absent"
    return 0
  fi

  [[ -f "$PROFILE_MARKER" ]] || die "refusing to delete non-managed DSH profile '$PROFILE'. Only profiles created by this script can be reset."

  echo "==> Removing script-managed DSH profile: $PROFILE"
  rm -rf "$PROFILE_DIR"
  echo "==> Done. Run ./scripts/orven-local.sh install to recreate it from '$TEMPLATE'."
}

build_and_pack() {
  echo "==> Using Orven checkout: $ROOT_DIR"
  echo "==> Installing workspace dependencies"
  pnpm --dir "$ROOT_DIR" install --no-frozen-lockfile

  if [[ "${ORVEN_FULL_CHECK:-0}" == "1" ]]; then
    echo "==> Running full checks"
    pnpm --dir "$ROOT_DIR" check
    pnpm --dir "$ROOT_DIR" distribution:check
  else
    echo "==> Building current checkout"
    pnpm --dir "$ROOT_DIR" build
  fi

  rm -rf "$PACK_DIR"
  mkdir -p "$PACK_DIR"

  echo "==> Packing @orven/core"
  pnpm --dir "$ROOT_DIR/packages/core" pack --pack-destination "$PACK_DIR"

  echo "==> Packing @orven/plugin-dsh"
  pnpm --dir "$ROOT_DIR/packages/plugin-dsh" pack --pack-destination "$PACK_DIR"

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
Use the dedicated profile (default: orven), or add:
  '@orven/core': 'file:$CORE_TGZ'
to the existing overrides section manually."
  fi

  cat >> "$WORKSPACE_FILE" <<EOF

$BEGIN_MARKER
overrides:
  '@orven/core': 'file:$CORE_TGZ'
$END_MARKER
EOF
}

install_local() {
  build_and_pack
  ensure_profile

  echo "==> Initializing DSH profile and installing @orven/core"
  dsh plugin --profile "$PROFILE" add "$CORE_TGZ"

  echo "==> Pinning plugin dependency to the local packed @orven/core"
  write_core_override

  echo "==> Installing @orven/plugin-dsh"
  dsh plugin --profile "$PROFILE" add "$PLUGIN_TGZ"

  echo
  echo "==> Installed current checkout"
  echo "profile : $PROFILE"
  echo "repo    : $ROOT_DIR"
  echo "core    : $CORE_TGZ"
  echo "plugin  : $PLUGIN_TGZ"
  echo
  echo "Next:"
  echo "  ./scripts/orven-local.sh dump"
  echo "  ./scripts/orven-local.sh run"
}

dump_config() {
  require_profile
  dsh --profile "$PROFILE" --dump-config
}

run_dsh() {
  require_profile
  if [[ "$#" -eq 0 ]]; then
    exec dsh --profile "$PROFILE"
  else
    exec dsh --profile "$PROFILE" "$@"
  fi
}

uninstall_local() {
  if [[ ! -d "$PROFILE_DIR" ]]; then
    echo "==> DSH profile '$PROFILE' is absent; nothing to uninstall"
    return 0
  fi

  echo "==> Removing Orven from DSH profile: $PROFILE"
  dsh plugin --profile "$PROFILE" remove @orven/plugin-dsh @orven/core || true
  remove_managed_override
  echo "==> Done"
}

print_paths() {
  cat <<EOF
repo:       $ROOT_DIR
packages:   $PACK_DIR
dsh home:   $DSH_HOME_DIR
profile:    $PROFILE_DIR
template:   $TEMPLATE
workspace:  $WORKSPACE_FILE
marker:     $PROFILE_MARKER
EOF
}

main() {
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
    reset)
      reset_profile
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
