@echo off
setlocal enabledelayedexpansion

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "MSBUILD_PATH="

if exist "%VSWHERE%" (
    for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe`) do (
        set "MSBUILD_PATH=%%i"
    )
)
if not defined MSBUILD_PATH (
    set "MSBUILD_PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
)
if not exist "%MSBUILD_PATH%" (
    echo [ERROR] MSBuild.exe Not Found.
    pause
    exit /b 1
)

echo [INFO] MSBuild locate: "%MSBUILD_PATH%"
echo.

set "SOLUTION_FILE=Build.slnx"
set "PLATFORMS=x64 x86"
set "CONFIGURATIONS=Debug DebugMT Release ReleaseMT"

echo -------------------------------------------------------

for %%P in (%PLATFORMS%) do (
    for %%C in (%CONFIGURATIONS%) do (
        echo.
        echo *******************************************************
        echo   Building..: [ %%C ] - %%P
        echo *******************************************************
        
        "%MSBUILD_PATH%" "%SOLUTION_FILE%" ^
            /p:Configuration=%%C ^
            /p:Platform=%%P ^
            /t:Rebuild ^
            /v:minimal ^
            /m

        if !errorlevel! neq 0 (
            echo.
            echo [FAIL] %%C - %%P Build Failed!
            pause
            exit /b 1
        )
    )
)

echo.
echo =======================================================
echo [SUCCESS] Build Complete.
echo =======================================================
pause