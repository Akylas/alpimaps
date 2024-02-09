package com.example.baselineprofile

import android.Manifest
import android.graphics.Point
import android.util.Log
import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.espresso.Espresso
import androidx.test.espresso.action.ViewActions
import androidx.test.espresso.matcher.ViewMatchers
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.rule.GrantPermissionRule;
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.Until

/**
 * This test class generates a basic startup baseline profile for the target package.
 *
 * We recommend you start with this but add important user flows to the profile to improve their performance.
 * Refer to the [baseline profile documentation](https://d.android.com/topic/performance/baselineprofiles)
 * for more information.
 *
 * You can run the generator with the "Generate Baseline Profile" run configuration in Android Studio or
 * the equivalent `generateBaselineProfile` gradle task:
 * ```
 * ./gradlew :app:generateReleaseBaselineProfile
 * ```
 * The run configuration runs the Gradle task and applies filtering to run only the generators.
 *
 * Check [documentation](https://d.android.com/topic/performance/benchmarking/macrobenchmark-instrumentation-args)
 * for more information about available instrumentation arguments.
 *
 * After you run the generator, you can verify the improvements running the [StartupBenchmarks] benchmark.
 *
 * When using this class to generate a baseline profile, only API 33+ or rooted API 28+ are supported.
 *
 * The minimum required version of androidx.benchmark to generate a baseline profile is 1.2.0.
 **/
@RunWith(AndroidJUnit4::class)
@LargeTest
class BaselineProfileGenerator {
    @get:Rule
    val rule = BaselineProfileRule()

    @get:Rule
    var grantPermissionRule: GrantPermissionRule =
        GrantPermissionRule.grant(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE)

    @Test
    fun startup() {
        // This example works only with the variant with application id `com.akylas.documentscanner`."
        rule.collect(
            packageName = PACKAGE_NAME,

            // See: https://d.android.com/topic/performance/baselineprofiles/dex-layout-optimizations
            includeInStartupProfile = true
        ) {
            // This block defines the app's critical user journey. Here we are interested in
            // optimizing for app startup. But you can also navigate and scroll through your most important UI.

            // Start default activity for your app
            pressHome()
            startActivityAndWait()
            // access file permission on android 12+
            device.wait(Until.hasObject(By.checkable(true)), 3_000)
            val switch = device.findObject(By.checkable(true));
            if (switch != null) {
                switch.click()
                device.pressBack()
                device.waitForIdle()
            }
    
            // Waits for content to be visible, which represents time to fully drawn.
            var input = By.descContains("cartoMap")
            device.wait(Until.hasObject(input), 2_000)
            val scrollable = device.findObject(input)
            // Setting a gesture margin is important otherwise gesture nav is triggered.
//            scrollable.setGestureMargin(device.displayWidth / 5)

            // From center we scroll 2/3 of it which is 1/3 of the screen.
            scrollable.drag(Point(0, scrollable.visibleCenter.y / 3))
            device.waitForIdle()
            input = By.desc("menuBtn")
            device.findObject(input).click()
            input = By.desc("settingsBtn")
            device.wait(Until.hasObject(input), 2_000)
            device.findObject(input).click()
            
            device.pressBack()
            device.pressBack()
        }
    }

    companion object {
        private const val PACKAGE_NAME = "akylas.alpi.maps"

    }
}