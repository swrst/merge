@echo off
setlocal EnableDelayedExpansion
rem Builds the Google Play release (.aab) on Windows. Needs Node, Android Studio,
rem android\keystore.properties + your upload key (docs\ANDROID-RELEASE.md, step 3)
rem and android\app\google-services.json (step 5).
rem Result: GalaxyAdventure-<version>.aab next to this file, ready to upload to Play Console.

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
if not exist android\keystore.properties (
  echo android\keystore.properties is missing: create the upload key first ^(docs\ANDROID-RELEASE.md, step 3^).
  exit /b 1
)
call npm run build:release || goto :err
call npx cap sync android || goto :err
cd android
rem stop any Gradle daemon that was started on the wrong Java
call gradlew.bat --stop >nul 2>&1
call gradlew.bat bundleRelease || (cd .. & goto :err)
cd ..
for /f "tokens=2 delims=:, " %%V in ('findstr /c:"\"name\"" version.json') do set "VER=%%~V"
copy /Y android\app\build\outputs\bundle\release\app-release.aab "GalaxyAdventure-!VER!.aab" >nul
echo.
echo Done: GalaxyAdventure-!VER!.aab
echo Upload it in Play Console: Test and release, then the testing track, then Create new release.
goto :eof
:err
echo.
echo Build failed - see the message above.
exit /b 1
