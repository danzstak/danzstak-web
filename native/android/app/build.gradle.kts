plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseStoreFile = providers.environmentVariable("DANZSTAK_ANDROID_KEYSTORE")
val releaseStorePassword = providers.environmentVariable("DANZSTAK_ANDROID_STORE_PASSWORD")
val releaseKeyAlias = providers.environmentVariable("DANZSTAK_ANDROID_KEY_ALIAS")
val releaseKeyPassword = providers.environmentVariable("DANZSTAK_ANDROID_KEY_PASSWORD")

android {
    namespace = "com.danzstak.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.danzstak.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        create("websiteRelease") {
            if (releaseStoreFile.isPresent) {
                storeFile = file(releaseStoreFile.get())
                storePassword = releaseStorePassword.orNull
                keyAlias = releaseKeyAlias.orNull
                keyPassword = releaseKeyPassword.orNull
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            if (releaseStoreFile.isPresent) {
                signingConfig = signingConfigs.getByName("websiteRelease")
            }
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
