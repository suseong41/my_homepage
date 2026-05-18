#include "pch.h"
#include "../../Src/suseong-project/test.h"

// ASSERT -> 반환
// EXPECT -> 계속 실행

TEST(suseongtest, prt)
{
	Jnu& jnu = Jnu::getInstance();
	std::string prt = jnu.hello();
	EXPECT_EQ(prt, "Hello World");
}

TEST(suseongtest, sum)
{
    Jnu& jnu = Jnu::getInstance();
	size_t a = 10;
	size_t b = 20;
	size_t result = jnu.sum(a, b);
	EXPECT_EQ(result, 30);
}

TEST(suseongtest, singleton)
{
    Jnu& jnu1 = Jnu::getInstance();
    Jnu& jnu2 = Jnu::getInstance();
    EXPECT_EQ(&jnu1, &jnu2);
}
