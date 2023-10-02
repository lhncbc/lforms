import { BrowserModule } from '@angular/platform-browser';
import { NgModule, Injector,  CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import  { createCustomElement } from '@angular/elements';

import { LForms } from './lforms';

import { LhcItemChoiceComponent } from './lhc-item-choice/lhc-item-choice.component';
import { LhcItemChoiceCheckBoxComponent } from './lhc-item-choice-check-box/lhc-item-choice-check-box.component';
import { LhcItemChoiceRadioButtonComponent } from './lhc-item-choice-radio-button/lhc-item-choice-radio-button.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { de_DE, NZ_I18N } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import de from '@angular/common/locales/de';

import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzSwitchModule } from 'ng-zorro-antd/switch';


import { CopyrightCircleFill, QuestionCircleFill, CopyrightCircleOutline } from '@ant-design/icons-angular/icons';
import { IconDefinition } from '@ant-design/icons-angular';
const icons: IconDefinition[] = [ CopyrightCircleFill, QuestionCircleFill, CopyrightCircleOutline ];

import { LhcItemChoiceAutocompleteComponent } from './lhc-item-choice-autocomplete/lhc-item-choice-autocomplete.component';
import { LhcItemComponent } from './lhc-item/lhc-item.component';
import { LhcUnitComponent } from './lhc-unit/lhc-unit.component';
import { LhcInputComponent } from './lhc-input/lhc-input.component';
import { LhcItemSimpleTypeComponent } from './lhc-item-simple-type/lhc-item-simple-type.component';
import { LhcItemQuantityComponent } from './lhc-item-quantity/lhc-item-quantity.component';
import { LhcAutocompleteComponent } from './common/lhc-autocomplete/lhc-autocomplete.component';
import { LhcValidateComponent } from './lhc-validate/lhc-validate.component';
import { LhcFormComponent } from './lhc-form/lhc-form.component';
import { LhcItemGroupComponent } from './lhc-item-group/lhc-item-group.component';
import { LhcItemBooleanComponent } from './lhc-item-boolean/lhc-item-boolean.component';
import { LhcItemDateComponent } from './lhc-item-date/lhc-item-date.component';
import { LhcItemTimeComponent } from './lhc-item-time/lhc-item-time.component';
import { LhcItemDatetimeComponent } from './lhc-item-datetime/lhc-item-datetime.component';
import { LhcItemTextComponent } from './lhc-item-text/lhc-item-text.component';
import { LhcItemQuestionTextComponent } from './lhc-item-question-text/lhc-item-question-text.component';
import { LhcItemQuestionComponent } from './lhc-item-question/lhc-item-question.component';
import { LhcItemDisplayComponent } from './lhc-item-display/lhc-item-display.component';
import { LhcGroupVerticalComponent } from './lhc-group-vertical/lhc-group-vertical.component';
import { LhcGroupHorizontalComponent } from './lhc-group-horizontal/lhc-group-horizontal.component';
import { LhcGroupMatrixComponent } from './lhc-group-matrix/lhc-group-matrix.component';
import { SafeHtmlPipe } from './safe-html.pipe';
import { LhcButtonPopoverComponent } from './lhc-button-popover/lhc-button-popover.component';
import { LhcItemAttachmentComponent } from './lhc-item-attachment/lhc-item-attachment.component';
import { LhcItemMessagesComponent } from './lhc-item-messages/lhc-item-messages.component';


registerLocaleData(de);

@NgModule({
  declarations: [
    LhcItemChoiceComponent,
    LhcItemChoiceCheckBoxComponent,
    LhcItemChoiceRadioButtonComponent,
    LhcItemChoiceAutocompleteComponent,
    LhcItemComponent,
    LhcUnitComponent,
    LhcItemSimpleTypeComponent,
    LhcInputComponent,
    LhcItemQuantityComponent,
    LhcAutocompleteComponent,
    LhcValidateComponent,
    LhcFormComponent,
    LhcItemGroupComponent,
    LhcItemBooleanComponent,
    LhcItemDateComponent,
    LhcItemTimeComponent,
    LhcItemDatetimeComponent,
    LhcItemTextComponent,
    LhcItemQuestionTextComponent,
    LhcItemQuestionComponent,
    LhcItemDisplayComponent,
    LhcGroupVerticalComponent,
    LhcGroupHorizontalComponent,
    LhcGroupMatrixComponent,
    SafeHtmlPipe,
    LhcButtonPopoverComponent,
    LhcItemAttachmentComponent,
    LhcItemMessagesComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    NzRadioModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzTimePickerModule,
    NzGridModule,
    NzPopoverModule,
    NzIconModule.forRoot(icons),
    NzSwitchModule
  ],
  providers: [
    { provide: NZ_I18N, useValue: de_DE }
  ],
  bootstrap: [],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
    // NO_ERRORS_SCHEMA
  ],
})


export class AppModule {
  constructor(private injector: Injector) {

    window['LForms'] = LForms;

    // define the web component
    customElements.define('wc-lhc-form', createCustomElement(LhcFormComponent, { injector: this.injector }));
  }

  ngDoBootstrap() {}
}

