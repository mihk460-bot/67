# بناء تطبيق Android و iOS (Capacitor)

التطبيق يفتح النسخة المنشورة من الموقع داخل غلاف أصلي، فأي تحديث تنشره يظهر فورًا في التطبيق دون إعادة رفع.

## قبل البدء
1. انشر التطبيق من زر Publish في Lovable.
2. اربط المشروع بـ GitHub ثم اسحبه على جهازك: `git clone <رابط المستودع>` ثم `npm install`.

## Android (APK)
المتطلبات: Android Studio + JDK 17.
```
npx cap add android
npx cap sync android
npx cap open android
```
- للتجربة: Build > Build APK(s) → الملف في `android/app/build/outputs/apk/debug/`.
- للنشر على Google Play: Build > Generate Signed Bundle (AAB) وأنشئ مفتاح توقيع واحفظه جيدًا.
- أو من الطرفية: `cd android && ./gradlew assembleRelease`.

## iOS
المتطلبات: جهاز Mac + Xcode + حساب Apple Developer (99$ سنويًا).
```
npx cap add ios
npx cap sync ios
npx cap open ios
```
- اختر فريقك في Signing & Capabilities.
- Product > Archive ثم Distribute App → App Store Connect / TestFlight.

## بعد أي تعديل في الإعدادات
`npx cap sync`

## تغيير الاسم أو المعرّف
عدّل `appId` و`appName` في `capacitor.config.ts` قبل أول `cap add`.
