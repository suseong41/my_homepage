#!/bin/bash

# 에러 발생 시 스크립트 중단
set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 로깅 헬퍼
log_header() {
    echo -e "\n${BOLD}${CYAN}=========================================${NC}"
    echo -e "${BOLD}${CYAN}  $1 ${NC}"
    echo -e "${BOLD}${CYAN}=========================================${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1 ${NC}"
}

log_success() {
    echo -e "${GREEN}✅  $1 ${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1 ${NC}"
}

# 에러 핸들러
error_handler() {
    echo -e "\n${RED}❌  Build Failed! (Line: $1)${NC}"
}
trap 'error_handler $LINENO' ERR

# 설정 및 함수
ROOT="$(cd "$(dirname "$0")" && pwd)"
JOBS="${JOBS:-16}"

build() {
  cmake -S "$ROOT" -B "$ROOT/Build" -DCMAKE_COLOR_MAKEFILE=ON --log-level=WARNING
  cmake --build "$ROOT/Build" --parallel "$JOBS"
}

clean() {
  find "$ROOT" -type d -name CMakeFiles -exec rm -rf {} +
  find "$ROOT" -type f \( -name "CMakeCache.txt" -o -name "cmake_install.cmake" -o -name "Makefile" \) -delete
  rm -rf "$ROOT/Build/Src" "$ROOT/Build/Test"
}

# 실행
log_header "Build Process Started"

build
log_success "Build Completed Successfully!"

log_header "Cleanup Process Started"
clean
log_success "CMake Clean Completed!"

echo -e "\n${BOLD}  All Tasks Finished!${NC}"