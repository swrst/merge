@echo off
setlocal EnableDelayedExpansion
rem Builds the tester APK on Windows. Needs Node and Android Studio installed.
rem Result: MergeRocket-test.apk next to this file.

rem Gradle 8 cannot run on Java 25 ("class file major version 69").
rem Find a Java 17-21: IntelliJ/Android Studio downloads first, then Android Studio's own.
set "JDK="
for /d %%J in ("%USERPROFILE%\.jdks\jbr-21*" "%USERPROFILE%\.jdks\*21*" "%USERPROFILE%\.jdks\*17*") do (
  if not defined JDK if exist "%%~J\bin\java.exe" set "JDK=%%~J"
)
for %%J in ("%ProgramFiles%\Android\Android Studio\jbr" "%LOCALAPPDATA%\Programs\Android Studio\jbr" "%ProgramFiles%\Android\Android Studio\jre") do (
  if not defined JDK if exist "%%~J\bin\java.exe" set "JDK=%%~J"
)
if not defined JDK (
  echo No Java 17-21 found. Install one, or set JAVA_HOME to it, and run again.
  exit /b 1
)
set "JAVA_HOME=%JDK%"
set "PATH=%JDK%\bin;%PATH%"
echo Using Java: %JDK%
"%JDK%\bin\java.exe" -version

call npm install || goto :err
call npm run build || goto :err
call npx cap sync android || goto :err
cd android
rem stop any Gradle daemon that was started on the wrong Java
call gradlew.bat --stop >nul 2>&1
call gradlew.bat assembleDebug || (cd .. & goto :err)
cd ..
copy /Y android\app\build\outputs\apk\debug\app-debug.apk MergeRocket-test.apk >nul
echo.
echo Done: MergeRocket-test.apk
echo Send it to testers (Drive, WhatsApp, email). They open it and allow "install unknown apps".
goto :eof
:err
echo.
echo Build failed - see the message above.
exit /b 1
