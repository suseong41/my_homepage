cmake_minimum_required(VERSION 3.10)
project(gTest)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(OUTPUT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../Build/LinuxRelease)

set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${OUTPUT_DIR})
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${OUTPUT_DIR})
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${OUTPUT_DIR})

# --------------------------------------------------- #

add_library(gtest STATIC src/gtest-all.cc)
target_include_directories(gtest PUBLIC 
    ${CMAKE_CURRENT_SOURCE_DIR} 
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

find_package(Threads REQUIRED)
target_link_libraries(gtest PUBLIC Threads::Threads)


# --------------------------------------------------- #

add_library(gtest_main STATIC src/gtest_main.cc)

target_include_directories(gtest_main PUBLIC 
    ${CMAKE_CURRENT_SOURCE_DIR} 
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(gtest_main PUBLIC gtest)