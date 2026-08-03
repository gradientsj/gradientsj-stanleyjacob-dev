cmake_minimum_required(VERSION 3.20)
project(cpp_two_sum_measurement LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(two_sum INTERFACE)
target_include_directories(two_sum INTERFACE include)

add_executable(two_sum_test tests/two_sum_test.cpp)
target_link_libraries(two_sum_test PRIVATE two_sum)
target_compile_options(two_sum_test PRIVATE
  $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall;-Wextra;-Wpedantic;-Wconversion;-Wshadow>
)

include(CTest)
add_test(NAME two_sum_correctness COMMAND two_sum_test)

option(CPP_TWO_SUM_BUILD_BENCHMARKS "Build the Google Benchmark executable" ON)
if(CPP_TWO_SUM_BUILD_BENCHMARKS)
  include(FetchContent)
  set(BENCHMARK_ENABLE_TESTING OFF CACHE BOOL "" FORCE)
  set(BENCHMARK_ENABLE_INSTALL OFF CACHE BOOL "" FORCE)
  set(BENCHMARK_ENABLE_GTEST_TESTS OFF CACHE BOOL "" FORCE)
  FetchContent_Declare(
    google_benchmark
    GIT_REPOSITORY https://github.com/google/benchmark.git
    GIT_TAG v1.9.5
    GIT_SHALLOW TRUE
  )
  FetchContent_MakeAvailable(google_benchmark)

  add_executable(two_sum_benchmark benchmarks/two_sum_benchmark.cpp)
  target_link_libraries(two_sum_benchmark PRIVATE two_sum benchmark::benchmark_main)
  target_compile_options(two_sum_benchmark PRIVATE
    $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall;-Wextra;-Wpedantic;-Wconversion;-Wshadow>
  )
endif()
