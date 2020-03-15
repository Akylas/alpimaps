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
const addContext = require('mochawesome/addContext');
const testReporterContext = {};
testReporterContext.name = "mochawesome";
/**
 * This folder should be the one provided in mocha.opts.
 * If omitted the default one is "mochawesome-report".
 * This is necessary because we need the logged images to be relatively
 * positioned according to mochawesome.html in the same folder
 */
testReporterContext.reportDir = "mochawesome-report";
testReporterContext.log = addContext;
testReporterContext.logImageTypes = [nativescript_dev_appium_1.LogImageType.screenshots];
nativescript_dev_appium_1.nsCapabilities.testReporter = testReporterContext;
before("start server", function () {
    return __awaiter(this, void 0, void 0, function* () {
        nativescript_dev_appium_1.nsCapabilities.testReporter.context = this;
        yield nativescript_dev_appium_1.startServer();
    });
});
after("stop server", function () {
    return __awaiter(this, void 0, void 0, function* () {
        yield nativescript_dev_appium_1.stopServer();
    });
});
//# sourceMappingURL=setup.js.map