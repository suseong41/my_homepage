#include "pch.h"
#include "test.h"

Test::Test() {};
Test::~Test() {};

Test& Test::getInstance()
{
    static Test instance;
    return instance;
}

std::string Test::hello()
{
	return "Hello World";
}

size_t Test::sum(size_t a, size_t b)
{
	return (a + b);
}
