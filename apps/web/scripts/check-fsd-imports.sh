#!/bin/sh
# Usage: check-fsd-imports.sh [src-dir] | --self-test
# Layers: _app > _pages > widgets > features > entities > shared.
# Fails on an import (alias or relative, static or dynamic) of a higher layer,
# of another slice in the same layer, or past a slice's index (shared and _app
# are exempt from the last rule).
set -u
set -f

LAYERS="shared entities features widgets _pages _app"

rank() {
  i=0
  for l in $LAYERS; do
    [ "$l" = "$1" ] && { echo $i; return; }
    i=$((i + 1))
  done
  echo -1
}

# resolve <dir relative to root> <relative spec>: path relative to root, or fail if it escapes root
resolve() {
  stack=""
  for seg in $(echo "$1/$2" | tr '/' ' '); do
    case $seg in
      .) ;;
      ..)
        [ -z "$stack" ] && return 1
        case $stack in */*) stack=${stack%/*} ;; *) stack="" ;; esac
        ;;
      *) stack=${stack:+$stack/}$seg ;;
    esac
  done
  echo "$stack"
}

violations() {
  root=$1
  for layer in $LAYERS; do
    [ -d "$root/$layer" ] || continue
    from_rank=$(rank "$layer")
    find "$root/$layer" -type f \( -name '*.ts' -o -name '*.tsx' \) | while read -r file; do
      rel=${file#"$root/$layer/"}
      slice=${rel%%/*}
      [ "$slice" = "$rel" ] && slice=""
      dir=${file#"$root/"}
      case $dir in */*) dir=${dir%/*} ;; *) dir="" ;; esac
      grep -oE "(from|import) *\(? *['\"](@/|\.\.?/)[^'\"]*['\"]" "$file" | sed -E "s/.*['\"]([^'\"]+)['\"]/\1/" | while read -r spec; do
        case $spec in
          @/*) target=${spec#@/} ;;
          *) target=$(resolve "$dir" "$spec") || continue ;;
        esac
        t_layer=${target%%/*}
        t_rank=$(rank "$t_layer")
        case $t_layer in
          lib|components)
            echo "$file: imports legacy $spec"
            continue
            ;;
        esac
        [ "$t_rank" = "-1" ] && continue
        rest=${target#*/}
        [ "$rest" = "$target" ] && rest=""
        t_slice=${rest%%/*}
        if [ "$t_rank" -gt "$from_rank" ]; then
          echo "$file: imports higher layer $spec"
        elif [ "$t_layer" = "$layer" ] && [ "$layer" != "shared" ] && [ "$t_slice" != "$slice" ]; then
          echo "$file: imports another slice $spec"
        elif [ "$t_layer" != "shared" ] && [ "$t_layer" != "_app" ] && [ "$t_layer/$t_slice" != "$layer/$slice" ]; then
          sub=""
          case $rest in */*) sub=${rest#*/} ;; esac
          case $sub in
            ""|index|index.server) ;;
            *) echo "$file: imports past slice index $spec" ;;
          esac
        fi
      done
    done
  done
}

check() {
  out=$(violations "$1")
  [ -z "$out" ] && return 0
  echo "$out" >&2
  return 1
}

if [ "${1:-}" = "--self-test" ]; then
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  # case <expected: pass|fail> <file relative to root> <content>
  fails=0
  case_() {
    rm -rf "$tmp/t"
    mkdir -p "$tmp/t/shared/lib" "$tmp/t/features/a" "$tmp/t/features/b"
    echo 'export const x = 1;' > "$tmp/t/features/a/index.ts"
    echo 'export const y = 1;' > "$tmp/t/features/b/index.ts"
    mkdir -p "$tmp/t/$(dirname "$2")"
    echo "$3" > "$tmp/t/$2"
    if check "$tmp/t" 2>/dev/null; then got=pass; else got=fail; fi
    [ "$got" = "$1" ] || { echo "self-test: expected $1 for: $3 (in $2)"; fails=1; }
  }
  case_ fail shared/lib/bad.ts 'import { r } from "@/lib/env";'
  case_ fail shared/lib/bad.ts 'import { r } from "../../components/a";'
  case_ pass shared/lib/ok.ts 'export const x = 1;'
  case_ fail shared/lib/bad.ts 'import { y } from "@/features/a";'
  case_ fail shared/lib/bad.ts 'import { y } from "../../features/a";'
  case_ fail shared/lib/bad.ts 'const m = await import("@/features/a");'
  case_ fail features/b/bad.ts 'import { y } from "@/features/a";'
  case_ fail features/b/bad.ts 'import { y } from "../a";'
  case_ fail features/b/bad.ts 'import { y } from "@/features/a/model/x";'
  case_ pass features/b/ok2.ts 'import { y } from "@/entities/a/index.server";'
  case_ fail features/b/bad2.ts 'import { y } from "@/entities/a/model/x";'
  case_ pass features/b/ok.ts 'import { y } from "./index";'
  case_ pass features/a/model/ok.ts 'import { y } from "../index";'
  case_ pass features/a/ok.ts 'import { y } from "@/shared/lib/x";'
  case_ pass shared/lib/ok.ts 'import { y } from "@/shared/config/x";'
  case_ pass shared/lib/ok.ts 'import { y } from "../../../../features/a";'
  [ "$fails" = 0 ] && echo "self-test ok"
  exit "$fails"
fi

sh "$0" --self-test >/dev/null || { sh "$0" --self-test; exit 1; }
check "${1:-apps/web/src}"
