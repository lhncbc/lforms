import { TestPage } from "./lforms_testpage.po";
import TestUtil from "./util";
import { browser, logging, element, by, WebElementPromise, ExpectedConditions } from 'protractor';
import * as FHIRSupport from "../../../src/fhir/versions.js";

let fhirVersions = Object.keys(FHIRSupport);
let tp: TestPage; 
let LForms: any = (global as any).LForms;
tp = new TestPage();

// Testing that questionnaire-hidden extension works as expected.
for (var i=0, len=fhirVersions.length; i<len; ++i) {
  (function (fhirVersion) {
    describe(fhirVersion + ': questionnaire-hidden extension', function() {
      
      beforeAll(async () => {
        await browser.waitForAngularEnabled(false);        
      });
      
      it('Instructions field G0.d should be hidden', function() {
        tp.openBaseTestPage();
        tp.loadFromTestData('Argonaut-questionnaire-questionnaire-example-asq3.json', fhirVersion);
        let hiddenInstructionsField = element(by.id('label-G0.d/1/1'));
        TestUtil.waitForElementNotPresent(hiddenInstructionsField)
      });

      it('non-hidden field G1/G1.4 should be displayed', function() {
        tp.openBaseTestPage();
        tp.loadFromTestData('Argonaut-questionnaire-questionnaire-example-asq3.json', fhirVersion);
        let formTitle = element(by.css(".lhc-form-title"));
        expect(formTitle.isDisplayed()).toBe(true);
        let normalField = element(by.id('label-G1.4/1/1'));
        expect(normalField.isDisplayed()).toBe(true);
      });
    });
  })(fhirVersions[i]);
}
