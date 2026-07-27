#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace cpp_patterns {

inline std::vector<std::size_t> prefix_function(std::string_view text) {
    std::vector<std::size_t> border(text.size(), 0);
    for (std::size_t i = 1; i < text.size(); ++i) {
        std::size_t length = border[i - 1];
        while (length > 0 && text[i] != text[length]) {
            length = border[length - 1];
        }
        if (text[i] == text[length]) ++length;
        border[i] = length;
    }
    return border;
}

inline std::vector<std::size_t> find_all_kmp(
    std::string_view pattern,
    std::string_view text
) {
    if (pattern.empty()) return {};
    std::string joined(pattern);
    joined.push_back('\0');
    joined.append(text);
    const auto border = prefix_function(joined);
    std::vector<std::size_t> matches;
    for (std::size_t i = pattern.size() + 1; i < joined.size(); ++i) {
        if (border[i] == pattern.size()) {
            matches.push_back(i - 2 * pattern.size());
        }
    }
    return matches;
}

inline std::vector<std::size_t> z_function(std::string_view text) {
    std::vector<std::size_t> z(text.size(), 0);
    if (text.empty()) return z;
    z[0] = text.size();
    std::size_t left = 0;
    std::size_t right = 0;
    for (std::size_t i = 1; i < text.size(); ++i) {
        if (i < right) z[i] = std::min(right - i, z[i - left]);
        while (i + z[i] < text.size() && text[z[i]] == text[i + z[i]]) {
            ++z[i];
        }
        if (i + z[i] > right) {
            left = i;
            right = i + z[i];
        }
    }
    return z;
}

class DoubleRollingHash {
public:
    explicit DoubleRollingHash(std::string_view text)
        : first_(text.size() + 1, 0), second_(text.size() + 1, 0),
          first_power_(text.size() + 1, 1), second_power_(text.size() + 1, 1) {
        for (std::size_t i = 0; i < text.size(); ++i) {
            const auto byte = static_cast<unsigned char>(text[i]);
            first_[i + 1] = (first_[i] * first_base + byte) % first_modulus;
            second_[i + 1] = (second_[i] * second_base + byte) % second_modulus;
            first_power_[i + 1] =
                first_power_[i] * first_base % first_modulus;
            second_power_[i + 1] =
                second_power_[i] * second_base % second_modulus;
        }
    }

    std::pair<std::int64_t, std::int64_t>
    slice(std::size_t begin, std::size_t end) const {
        const std::size_t length = end - begin;
        auto first = (
            first_[end] - first_[begin] * first_power_[length]
        ) % first_modulus;
        auto second = (
            second_[end] - second_[begin] * second_power_[length]
        ) % second_modulus;
        if (first < 0) first += first_modulus;
        if (second < 0) second += second_modulus;
        return {first, second};
    }

private:
    static constexpr std::int64_t first_modulus = 1'000'000'007;
    static constexpr std::int64_t second_modulus = 998'244'353;
    static constexpr std::int64_t first_base = 131;
    static constexpr std::int64_t second_base = 137;
    std::vector<std::int64_t> first_;
    std::vector<std::int64_t> second_;
    std::vector<std::int64_t> first_power_;
    std::vector<std::int64_t> second_power_;
};

inline std::string longest_palindrome(std::string_view source) {
    const auto size = static_cast<std::ptrdiff_t>(source.size());
    std::vector<std::size_t> odd(source.size(), 0);
    std::ptrdiff_t left = 0;
    std::ptrdiff_t right = -1;
    for (std::ptrdiff_t center = 0; center < size; ++center) {
        std::ptrdiff_t radius = center > right
            ? 1
            : std::min<std::ptrdiff_t>(
                  static_cast<std::ptrdiff_t>(
                      odd[static_cast<std::size_t>(left + right - center)]
                  ),
                  right - center + 1
              );
        while (center - radius >= 0 && center + radius < size &&
               source[static_cast<std::size_t>(center - radius)] ==
                   source[static_cast<std::size_t>(center + radius)]) {
            ++radius;
        }
        odd[static_cast<std::size_t>(center)] =
            static_cast<std::size_t>(radius);
        if (center + radius - 1 > right) {
            left = center - radius + 1;
            right = center + radius - 1;
        }
    }

    std::vector<std::size_t> even(source.size(), 0);
    left = 0;
    right = -1;
    for (std::ptrdiff_t center = 0; center < size; ++center) {
        std::ptrdiff_t radius = center > right
            ? 0
            : std::min<std::ptrdiff_t>(
                  static_cast<std::ptrdiff_t>(
                      even[static_cast<std::size_t>(
                          left + right - center + 1
                      )]
                  ),
                  right - center + 1
              );
        while (center - radius - 1 >= 0 && center + radius < size &&
               source[static_cast<std::size_t>(center - radius - 1)] ==
                   source[static_cast<std::size_t>(center + radius)]) {
            ++radius;
        }
        even[static_cast<std::size_t>(center)] =
            static_cast<std::size_t>(radius);
        if (center + radius - 1 > right) {
            left = center - radius;
            right = center + radius - 1;
        }
    }

    std::size_t best_start = 0;
    std::size_t best_length = 0;
    for (std::size_t center = 0; center < source.size(); ++center) {
        const std::size_t odd_length = 2 * odd[center] - 1;
        if (odd_length > best_length) {
            best_length = odd_length;
            best_start = center - odd[center] + 1;
        }
        const std::size_t even_length = 2 * even[center];
        if (even_length > best_length) {
            best_length = even_length;
            best_start = center - even[center];
        }
    }
    return std::string(source.substr(best_start, best_length));
}

inline std::int64_t modular_power(
    std::int64_t base,
    std::int64_t exponent,
    std::int64_t modulus
) {
    std::int64_t result = 1 % modulus;
    base %= modulus;
    if (base < 0) base += modulus;
    while (exponent > 0) {
        if ((exponent & 1) != 0) result = result * base % modulus;
        base = base * base % modulus;
        exponent >>= 1;
    }
    return result;
}

class CombinationsModPrime {
public:
    CombinationsModPrime(std::size_t limit, std::int64_t prime_modulus)
        : modulus_(prime_modulus), factorial_(limit + 1),
          inverse_factorial_(limit + 1) {
        factorial_[0] = 1;
        for (std::size_t value = 1; value <= limit; ++value) {
            factorial_[value] =
                factorial_[value - 1] * static_cast<std::int64_t>(value) %
                modulus_;
        }
        inverse_factorial_[limit] =
            modular_power(factorial_[limit], modulus_ - 2, modulus_);
        for (std::size_t value = limit; value > 0; --value) {
            inverse_factorial_[value - 1] =
                inverse_factorial_[value] *
                static_cast<std::int64_t>(value) % modulus_;
        }
    }

    std::int64_t choose(std::size_t total, std::size_t selected) const {
        if (selected > total || total >= factorial_.size()) return 0;
        return factorial_[total] * inverse_factorial_[selected] % modulus_ *
               inverse_factorial_[total - selected] % modulus_;
    }

private:
    std::int64_t modulus_;
    std::vector<std::int64_t> factorial_;
    std::vector<std::int64_t> inverse_factorial_;
};

inline std::vector<int> smallest_prime_factors(int limit) {
    std::vector<int> factor(static_cast<std::size_t>(limit + 1), 0);
    for (int prime = 2; prime <= limit; ++prime) {
        if (factor[static_cast<std::size_t>(prime)] != 0) continue;
        for (int multiple = prime; multiple <= limit; multiple += prime) {
            auto& entry = factor[static_cast<std::size_t>(multiple)];
            if (entry == 0) entry = prime;
        }
    }
    return factor;
}

inline int single_number(std::span<const int> values) {
    int answer = 0;
    for (const int value : values) answer ^= value;
    return answer;
}

}  // namespace cpp_patterns
