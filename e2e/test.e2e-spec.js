"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const nativescript_dev_appium_1 = require("nativescript-dev-appium");
const chai_1 = require("chai");
const addContext = require('mochawesome/addContext');
describe('main test scenario', () => {
    let driver;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                nativescript_dev_appium_1.nsCapabilities.testReporter.context = this;
                driver = yield nativescript_dev_appium_1.createDriver();
                console.log('before driver!');
            }
            catch (e) {
                console.log('before error', e);
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield driver.quit();
            console.log('Quit driver!');
        });
    });
    afterEach(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentTest.state === 'failed') {
                yield driver.logTestArtifacts(this.currentTest.title);
            }
        });
    });
    it('displays the pairing screen', () => __awaiter(void 0, void 0, void 0, function* () {
        const button = yield driver.findElementByAccessibilityId('pair');
        // Image verification
        // await driver.driver.sleep(2500) // animation
        chai_1.assert.isTrue(!!button);
    }));
    /*
     *  Login
     */
    describe('go home', () => __awaiter(void 0, void 0, void 0, function* () {
        it('click to go home', () => __awaiter(void 0, void 0, void 0, function* () {
            const logoImg = yield driver.findElementByAccessibilityId('pairingLogo');
            logoImg.hold(1000);
            yield driver.driver.sleep(1000); // animation
            // check that we are home!
            const homeGrid = yield driver.findElementByAccessibilityId('homeGrid');
            chai_1.assert.isTrue(!!homeGrid);
        }));
    }));
    // const styleTypes = {
    //     "inline": "styleInline",
    //     "page": "stylePage",
    //     "app": "styleApp"
    // };
    // for (let styleType in styleTypes) {
    //     it(`should find an element with ${styleType} style applied`, async function () {
    //         const element = await driver.findElementByText(styleTypes[styleType]);
    //         driver.imageHelper.options.keepOriginalImageSize = false;
    //         driver.imageHelper.options.isDeviceSpecific = false;
    //         const result = await driver.compareElement(element, "style");
    //         assert.isTrue(result);
    //     });
    // }
});
//# sourceMappingURL=test.e2e-spec.js.map