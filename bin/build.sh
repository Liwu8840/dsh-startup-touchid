#!/bin/sh
# 编译 Touch ID helper。
#   ./build.sh            → 编到同目录的 dsh-touchid（开发用）
#   ./build.sh /some/dir  → 编到指定目录（运行时缓存用）
set -e

SRC_DIR=$(cd "$(dirname "$0")" && pwd)
OUT_DIR=${1:-$SRC_DIR}
OUT="$OUT_DIR/dsh-touchid"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "dsh-touchid: 只有 macOS 支持 Touch ID（当前 $(uname -s)）" >&2
  exit 2
fi

if ! command -v clang >/dev/null 2>&1; then
  echo "dsh-touchid: 找不到 clang。请安装 Xcode Command Line Tools：xcode-select --install" >&2
  exit 3
fi

mkdir -p "$OUT_DIR"
# 用 ObjC 而非 Swift：CLT 的 swiftc 与 SDK 版本可能不匹配，clang 没这个问题
clang -O2 -fobjc-arc \
  -framework Foundation -framework LocalAuthentication \
  "$SRC_DIR/touchid.m" -o "$OUT"
echo "built: $OUT"
