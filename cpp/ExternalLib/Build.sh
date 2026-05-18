#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_header() {
    echo -e "\n${BOLD}${CYAN}=========================================${NC}"
    echo -e "${BOLD}${CYAN}  $1 ${NC}"
    echo -e "${BOLD}${CYAN}=========================================${NC}"
}
log_info() { echo -e "${BLUE}ℹ️  $1 ${NC}"; }
log_success() { echo -e "${GREEN}✅  $1 ${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1 ${NC}"; }
error_handler() { echo -e "\n${RED}❌  ExternalLib Build Failed! (Line: $1)${NC}"; }
trap 'error_handler $LINENO' ERR

ROOT="$(cd "$(dirname "$0")" && pwd)"
JOBS="${JOBS:-16}" 
BUILD_DIR="$ROOT/Build"

build() {
  log_info "Configuring CMake..."
  cmake -S "$ROOT" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release --log-level=WARNING

  log_info "Building with $JOBS jobs..."
  cmake --build "$BUILD_DIR" --parallel "$JOBS"
}

clean() {
  log_info "Cleaning CMake artifacts (Keeping libraries)..."
  
  if [ -d "$BUILD_DIR" ]; then
      find "$BUILD_DIR" -name "CMakeFiles" -type d -exec rm -rf {} +
      
      find "$BUILD_DIR" -type f \( -name "CMakeCache.txt" -o -name "cmake_install.cmake" -o -name "Makefile" \) -delete
      
      log_info "Removed CMake cache and configuration files."
  else
      log_warn "Build directory not found, nothing to clean."
  fi
}


log_header "ExternalLib Build Process Started"

build
log_success "Build Completed Successfully!"

log_header "Cleanup Process Started"
clean
log_success "CMake Configuration Cleaned!"

echo -e "\n${BOLD}  All Tasks Finished!${NC}"