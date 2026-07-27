cmake_minimum_required(VERSION 3.20)
project(cpp_patterns LANGUAGES CXX)

add_executable(cpp_patterns_test tests/cpp_patterns_test.cpp)
target_include_directories(cpp_patterns_test PRIVATE include)
target_compile_features(cpp_patterns_test PRIVATE cxx_std_20)

if(MSVC)
  target_compile_options(cpp_patterns_test PRIVATE /W4 /permissive-)
else()
  target_compile_options(
    cpp_patterns_test
    PRIVATE
      -Wall
      -Wextra
      -Wpedantic
      -Wconversion
      -Wshadow
  )
endif()

enable_testing()
add_test(NAME cpp_patterns_correctness COMMAND cpp_patterns_test)
