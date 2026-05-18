#pragma once
#include <stdint.h>
// + singleton exam

class Test
{
public:
    static Test& getInstance();
    Test(const Test& rhs) = delete;
    Test operator=(const Test& rhs) = delete;
    
	std::string hello();
	size_t sum(size_t a, size_t b);
private:
    Test();
    ~Test();
};
