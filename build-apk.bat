@echo off
rem Builds the tester APK on Windows. Needs Node and Android Studio installed.
rem Result: MergeRocket-test.apk next to this file.

rem Gradle 8 cannot run on a too-new Java (e.g. Java 25 = "class file major version 69").
rem Use the Java 21 that ships with Android Studio, wherever it is installed.
set "AS_JAVA="
for %%J in ("%ProgramFiles%\Android\Android Studio\jbr" "%LOCALAPPDATA%\Programs\Android Studio\jbr" "%ProgramFiles%\Android\Android Studio\jre") do (
  if exist "%%~J\bin\java.exe" set "AS_JAVA=%%~J"
)
if defined AS_JAVA (
  set "JAVA_HOME=%AS_JAVA%"
  set "PATH=%AS_JAVA%\bin;%PATH%"
  echo Using Java from %AS_JAVA%
) else (
  echo Android Studio's Java not found - using the system Java. If the build fails with "major version", set JAVA_HOME to a Java 21.
)
call npm install || goto :err
call npm run build || goto :err
call npx cap sync android || goto :err
cd android
call gradlew.bat assembleDebug || (cd .. & goto :err)
cd ..
copy /Y android\app\build\outputs\apk\debug\app-debug.apk MergeRocket-test.apk >nul
echo.
echo Done: MergeRocket-test.apk
echo Send it to testers (Drive, WhatsApp, email). They open it and allow "install unknown apps".
goto :eof
:err
echo.
echo Build failed - see the message above. If Gradle cannot find the SDK, open the android folder once in Android Studio.
exit /b 1
