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

TEST_SOURCE_DIR="$ROOT/Test/suseong-test"
TEST_EXECUTABLE="$ROOT/Build/LinuxRelease/suseong-test"
export CXXFLAGS="${CXXFLAGS} -fdiagnostics-color=always"

build() {
  cmake -S "$TEST_SOURCE_DIR" -B "$ROOT/Build" -DCMAKE_COLOR_MAKEFILE=ON --log-level=WARNING
  cmake --build "$ROOT/Build" --parallel "$JOBS"
}

run_test() {

  if [ -f "$TEST_EXECUTABLE" ]; then
      "$TEST_EXECUTABLE"
  else
      echo -e "${RED}Error: Test executable not found at $TEST_EXECUTABLE${NC}"
      exit 1
  fi
}

clean() {
  find "$ROOT" -type d -name CMakeFiles -exec rm -rf {} +
  find "$ROOT" -type f \( -name "CMakeCache.txt" -o -name "cmake_install.cmake" -o -name "Makefile" \) -delete
}

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --clean    Execute clean only (remove build artifacts) and exit."
    echo "  --help     Show this help message."
}

if [ $# -eq 0 ]; then
    MODE="build"
else
    # 2. 인자가 있는 경우 파싱
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --clean)
                MODE="clean"
                shift # 인자 이동
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                usage
                exit 1
                ;;
        esac
    done
fi

# 실행

if [ "$MODE" = "clean" ]; then
    log_header "Cleanup Process Started"
    clean
    log_success "Clean Completed!"
    exit 0
fi

log_header "Test Build Process Started"
build
log_success "Build Completed Successfully!"

log_header "Running Google Tests"
set +e
if [ -f "$TEST_EXECUTABLE" ]; then
    TEST_DIR=$(dirname "$TEST_EXECUTABLE")
    TEST_BIN=$(basename "$TEST_EXECUTABLE")

    echo "Changing directory to: $TEST_DIR"
    (
        cd "$TEST_DIR" && "./$TEST_BIN"
    )
    
    TEST_RESULT=$?
else
    echo -e "${RED}Error: Test executable not found!${NC}"
    TEST_RESULT=1
fi
set -e

exit $TEST_RESULT