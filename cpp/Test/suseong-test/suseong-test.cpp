#include "pch.h"
#include "../../Src/suseong-project/test.h"

// ASSERT -> 반환
// EXPECT -> 계속 실행

TEST(suseongtest, prt)
{
	::Test& obj = ::Test::getInstance();
	std::string prt = obj.hello();
	EXPECT_EQ(prt, "Hello World");
}

TEST(suseongtest, sum)
{
    ::Test& obj = ::Test::getInstance();
	size_t a = 10;
	size_t b = 20;
	size_t result = obj.sum(a, b);
	EXPECT_EQ(result, 30);
}

TEST(suseongtest, singleton)
{
    ::Test& obj1 = ::Test::getInstance();
    ::Test& obj2 = ::Test::getInstance();
    EXPECT_EQ(&obj1, &obj2);
}
