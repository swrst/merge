@echo off
rem Builds the tester APK on Windows. Needs Node and Android Studio installed.
rem Result: MergeRocket-test.apk next to this file.
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
