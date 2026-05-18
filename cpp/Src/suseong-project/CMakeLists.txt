cmake_minimum_required(VERSION 3.10)
project(jnusimple-project)

set(TARGET_NAME jnusimple-project)
set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=gnu++20 -fPIC")

set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/../../Build/LinuxRelease)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/../../Build/LinuxRelease)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/../../Build/LinuxRelease)

message(STATUS "CMAKE_ARCHIVE_OUTPUT_DIRECTORY: " ${CMAKE_ARCHIVE_OUTPUT_DIRECTORY})
message(STATUS "CMAKE_LIBRARY_OUTPUT_DIRECTORY: " ${CMAKE_LIBRARY_OUTPUT_DIRECTORY})
message(STATUS "CMAKE_RUNTIME_OUTPUT_DIRECTORY: " ${CMAKE_RUNTIME_OUTPUT_DIRECTORY})

##############################################################
## Utility functions
##############################################################
function(exclude_from_list SOURCES_LIST EXPRESSION)
	file(GLOB_RECURSE EXCLUDE ${EXPRESSION})	
	if(EXCLUDE)
		list(REMOVE_ITEM ${SOURCES_LIST} ${EXCLUDE})
	endif()
	set(${SOURCES_LIST} ${${SOURCES_LIST}} PARENT_SCOPE)
endfunction(exclude_from_list)

function(include_to_list SOURCES_LIST EXPRESSION)
	file(GLOB_RECURSE EXCLUDE ${EXPRESSION})	
	if(EXCLUDE)
		list(APPEND ${SOURCES_LIST} ${EXCLUDE})
	endif()
	set(${SOURCES_LIST} ${${SOURCES_LIST}} PARENT_SCOPE)
endfunction(include_to_list)


##############################################################
## Source Filtering
##############################################################
# Glob all source files and filt-out later
file(GLOB_RECURSE SOURCES *.cpp *.c)

if(APPLE)
	exclude_from_list(SOURCES *_Win.cpp)
	exclude_from_list(SOURCES *_Linux.cpp)
	include_to_list(SOURCES *_Mac_Linux.cpp)
else()
	exclude_from_list(SOURCES *_Win.cpp)
	exclude_from_list(SOURCES *_Mac.cpp)
	include_to_list(SOURCES *_Linux_Mac.cpp)
endif()

foreach(SOURCE IN LISTS SOURCES)
	message(STATUS "SOURCE - " ${SOURCE})
endforeach(SOURCE)

##############################################################
## Build setting
##############################################################
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/../Inc)
add_library(${TARGET_NAME} STATIC ${SOURCES})

target_link_libraries(${TARGET_NAME} 
    dl 
    pthread
)
