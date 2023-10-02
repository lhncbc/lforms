/**
 * LForms class for form definition data
 */

// Note: code after "//// TODO" are temparorily commented out

// jQuery is added in angular.json
//import jQuery from "jquery"; // not to use, otherwise two copies of the lib will be used.
import CONSTANTS from "./lhc-form-datatypes.js";
import LhcFormUtils from "./lhc-form-utils.js";
import CommonUtils from "./lhc-common-utils.js";
import {InternalUtil} from "./internal-utils.js";
import version from '../../version.json';

import Validation from "./lhc-form-validation.js"

//import LForms from "./lforms";
// const LForms = (window as any).LForms;
declare var LForms: any;

import {Units, Formulas} from "./lhc-form-units.js";

export default class LhcFormData {

  // form's code
  code = null;
  codeList = null;
  identifier = null;
  // form's name
  name = null;

  // additional options that controls the selected view template
  templateOptions:any = {};

  // the question items defined in a form
  items = [];

  // a delimiter used in code path and id path
  PATH_DELIMITER = "/";

  // whether the form data contains saved user data
  hasSavedData = false;

  // whether the form data is valid 
  // (it only checks on INT/REAL types when getUserData() is called.)
  _invalidData = false;

  // repeatable question items derived from items
  _repeatableItems = {};

  // All accessory attributes of an item
  // (move all other properties into this _opt eventually.)
  _opt = {};

  // action logs for screen reader
  _actionLogs = [];

  // active item, where a input field in the row has the focus
  _activeItem = null;

  // default template options
  _defaultTemplateOptions = {
    // whether question code is displayed next to the question
    showQuestionCode: false,
    // whether to show coding instruction inline. (false: in popover; true: inline)
    showCodingInstruction: false,
    // whether to allow more than one unused repeating item/section
    allowMultipleEmptyRepeatingItems: false,
    // whether to allow HTML content in the codingInstructions field.
    allowHTMLInInstructions: false,
    displayControl: {
      // controls the question layout of the form. default value for questionLayout is "vertical".
      // available value could be "horizontal" when all the items in the form are on the same level,
      // or "matrix" when all the item are on the same level and all are CWE or CNE types items and all have the same list of answers.
      // not changeable on a rendered form.
      "questionLayout": "vertical"
    },
    // controls the view mode of the form, permitted values are "lg", "md", "sm", and "auto".
    // meaning the layout is responsive to the screen/container's size
    // each item can override this setting for the item by setting its own value in displayControl.viewMode
    viewMode: "auto",
    // controls the default answer layout for CWE/CNE typed items if answerLayout is not specified on the item's displayControl.
    // not changeable on a rendered form.
    defaultAnswerLayout: {
      "answerLayout": {
        "type": "COMBO_BOX", // "COMBO_BOX" -- use autocompleter
                            // "RADIO_CHECKBOX" -- all answers displayed as radio buttons or checkboxes
        "columns": "0"   // valid only when "type" is "RADIO_CHECKBOX". Permissible values include:
                          // "0" -- flexible
                          // "1", "2", "3", "4", "5", "6" -- listed in columns
      }
    },
    // whether to hide tree line styles
    hideTreeLine: false,
    // whether to hide indentation before each item
    hideIndentation: false,
    // whether to hide repetition numbers next to the item's text
    hideRepetitionNumber: false,
    // whether to display score along with text when there scores in answers
    displayScoreWithAnswerText: true
  };

  // other instance level variables that were not previously listed
  lformsVersion = version.lformsVersion;
  _packageStore = null;
  _variableExt = null;
  _codePath = "";
  _idPath = "";
  _displayLevel = 0;
  _linkToDef = null;
  _formReady;
  _horizontalTableInfo = {};
  itemList;
  itemHash;
  _asyncChangeListeners;
  fhirVersion;
  _fhir;
  _hasInitialExpr;
  extension;
  codeSystem;
  template;
  answerLists;
  _expressionProcessor;
  _fhirVariables;
  _hasResponsiveExpr;
  copyrightNotice;
  type;
  _showErrors;
  _showWarnings;
  _showInfo;

  /**
   * Constructor
   * @param data the lforms form definition data
   * @param packageStore optional, an array that stores a list of FHIR resources
   *       needed by the Questionnaire. Currently only the expanded ValueSet is
   *       supported. Its format is same as the 'files' part in the .index.json
   *       file in a FHIR resource package files.
   *       (see https://confluence.hl7.org/display/FHIR/NPM+Package+Specification),
   *       plus a 'fileContent' field that contains the actual file contents.
   */
  constructor(data, packageStore=null) {

    if (packageStore) {
      this._packageStore = packageStore;
    }

    if(data && data._initializeInternalData) { // This is already a lformsData object.
      var props = Object.getOwnPropertyNames(data);
      for(var i = 0; i < props.length; i++) {
        if(props[i] && !props[i].startsWith('_') && typeof data[props[i]] !== 'function') {
          this[props[i]] = data[props[i]];
        }
      }
      // Preserve _variableExt as FHIR variable extensions have been moved to _variableExt during the LFormsData construction.
      if(data._variableExt) {
        this._variableExt = data._variableExt;
      }
    }
    else {
      //jQuery.extend(this, data);
      Object.assign(this, data);
      this.templateOptions = data.templateOptions || {};
      this.PATH_DELIMITER = data.PATH_DELIMITER || "/";
    }

    // if FHIR libs are loaded and the data is converted from a FHIR Questionnaire
    if (LForms.FHIR && data.fhirVersion) {
      this._initializeFormFHIRData(data);
    }

    // update internal data (_id, _idPath, _codePath, _displayLevel_),
    // that are used for widget control and/or for performance improvement.
    this._initializeInternalData();

    // this.setMessageLevel('info'); // for now hide messages by default
  }

  /**
   *  Sets the level of error/warning/info mesages to show on the form.
   * @param level - if set to 'error' only error messages will be shown, if set
   *  to 'warning', error and warnings will be shown, and if set to 'info' all
   *  message types will be shown.  If any other value (e.g., null) no messages
   *  will be shown.
   */
  setMessageLevel(level) {
    this._showInfo = level=='info';
    this._showWarnings = this._showInfo || level=='warning';
    this._showErrors = this._showWarnings || level=='error';
  }


  /**
   * Find the resource in the form's packageStore by resource type and identifier.
   * @param resType FHIR resource type, e.g. ValueSet, CodeSystem.
   * @param resIdentifier an id or an canonical URL of a FHIR resource.
   *        "http://hl7.org/fhir/uv/sdc/ValueSet/dex-mimetype"
   *        or "http://hl7.org/fhir/uv/sdc/ValueSet/dex-mimetype|2.8.0"
   *        (or "http://hl7.org/fhir/uv/sdc/ValueSet/dex-mimetype|2.8.0#vs1", TBD)
   * Note: The reference could be a contained ValueSet in a different resource
   * See https://www.hl7.org/fhir/references.html#canonical-fragments
   * @returns {null} a FHIR resource
   * @private
   */
  _getResourcesFromPackageStore(resType, resIdentifier) {

    var resReturn = null;

    if (this._packageStore && resIdentifier && resType) {
      var splited = resIdentifier.split("|");
      var url = splited[0];
      var version = splited[1];
      for (var i=0, iLen=this._packageStore.length; i<iLen; i++) {
        var resource = this._packageStore[i];
        if (resource.resourceType === resType && resource.url === url &&
            (version && resource.version === version || !version) ) {
          resReturn = JSON.parse(JSON.stringify(resource));
          break;
        }
      }
    }
    return resReturn;
  }


  /**
   * Get a list of warning messages where answer lists are not loaded from URLs
   * in 'answerValueSet'
   */
  checkAnswersResourceStatus() {
    var status = [];
    for (var i=0, iLen=this.itemList.length; i<iLen; i++) {
      var item = this.itemList[i];
      if (item.answerValueSet && ! item.answers) {
        status.push("Resource not loaded: " + item.answerValueSet)
      }
    }

    return status;
  }

  /**
   *  Registers a callback for use if the rendering of the form
   *  requires the asynchronous operations (e.g. the loading of external
   *  resources) which could affect the content.  Potentially, the function could
   *  be called more than once, or after a related group of resources have
   *  completed loading.
   */
  addAsyncChangeListener(listener) {
    if (!this._asyncChangeListeners)
      this._asyncChangeListeners = [];
    this._asyncChangeListeners.push(listener);
  }


  /**
   *  Calls the listeners registered via addAsyncChangeListener.
   */
  _notifyAsyncChangeListeners() {
    if (this._asyncChangeListeners) {
      for (var i=0, len=this._asyncChangeListeners.length; i<len; ++i)
        this._asyncChangeListeners[i]();
    }
  }


  /**
   *  Initializes form-level FHIR data.  This should be called before item
   *  properties are set up, because it sets properties like this.fhirVersion
   *  which might be needed for processing the items.
   * @param data - LForms form definition object (or LFormsData).
   */
  _initializeFormFHIRData(data) {
    var lfData = this;
    this.fhirVersion = data.fhirVersion;
    this._fhir = LForms.FHIR[lfData.fhirVersion];
    this._expressionProcessor = new this._fhir.SDC.ExpressionProcessor(this);
    this._fhirVariables = {};
    this.extension = data.extension ? data.extension.slice(0) : null; // Shallow copy

    if (data.extension) {
      this._fhir.SDC.buildExtensionMap(this);
      this._hasResponsiveExpr = this._hasResponsiveExpr ||
        this._fhir.SDC.hasResponsiveExpression(this);
      this._hasInitialExpr = this._hasInitialExpr ||
        this._fhir.SDC.hasInitialExpression(this);
    }

    this._fhir.SDC.processExtensions(lfData, 'obj_title');
  }


  /**
   *  Returns the object containing the FHIR support.  If this LFormsData
   *  does not have fhirVersion set or if support for that version is not
   *  loaded, then a support object for some FHIR version will be returned,
   *  if any is loaded.  (In some cases, we do not care which version is
   *  used.)  If no fhir support is loaded, then an exception will be thrown.
   */
  _getFHIRSupport() {
    var rtn = this._fhir;
    if (!rtn) {
      var loadedVersions = Object.keys(LForms.FHIR);
      if (loadedVersions.length > 0)
        rtn = LForms.FHIR[loadedVersions[0]];
      if (!rtn)
        throw new Error('The LHC-Forms FHIR support file was not loaded.');
      else
        this._fhir = rtn;
    }
    return rtn;
  }


 /**
   *  Loads FHIR resources necessary to show the form.  These are loaded
   *  asynchronously.  When the asynchronous requests have completed, if
   *  "prepoluate" is set to true, the form will be partially filled in with
   *  values from the resources as extensions indicate (e.g.
   *  observationLinkPeriod and initialExpression).
   *  Prior to calling this, LForms.Util.setFHIRContext() should have been
   *  called, so that communication with the FHIR server can take place.
   * @param prepopulate whether or not to perform prepoluation.  If the form
   *  being shown is going to include previously saved user data, this flag
   *  should be set to false (which is the default).
   */
  loadFHIRResources(prepopulate) {
    if (!LForms.fhirContext) {
      //throw new Error('LForms.Util.setFHIRContext() must be called before loadFHIRResources');
      console.log('Warning: FHIR resources might not be loaded, because loadFHIRResources() was called before LForms.Util.setFHIRContext()');
    }
    var lfData = this;

    var sdc = this._fhir.SDC;
    var pendingPromises = sdc.loadLaunchContext(this);

    // answerValueSet (for prefetched lists)
    pendingPromises = pendingPromises.concat(sdc.loadAnswerValueSets(this));

    if (prepopulate)
      pendingPromises.push(sdc.requestLinkedObs(this));

    return Promise.all(pendingPromises).then(function() {
      lfData._notifyAsyncChangeListeners();
    })
    .catch(function fail(e) {
      throw e
    });
  }


  /**
   *  An internal function for safely constructing a URL based on a path
   *  segments and query parameters.
   * @param pathParts An array of path segments (not including the protocol).
   *  These will be URL-encoded.
   * @param queryParams (optional) A object of key/value pairs (string values)
   *  for the query part of the URL.  Values be URL-encoded.
   */
  _buildURL(pathParts, queryParams) {
    // Would Use URL and URLSearchParams, except for the need to support IE11
    // It looks like if we update babel, we could have a polyfill, but I don't
    // want to revise the build configuration at the moment.
    let url = pathParts.map(part=>encodeURIComponent(part)).join('/');
    if (queryParams) {
      // Assuming a single value per key, for now.
      url += '?' + Object.keys(queryParams).map(
        k=>k+'='+encodeURIComponent(queryParams[k])).join('&');
    }
    return url;
  }


  /**
   * Load ValueSet from the resource package, convert it the LForms' answers format
   * and set it on item.answers
   * @param item an item of lforms
   * @private
   */
  _loadAnswerValueSetsFromPackage(item) {

    if (item.answerValueSet) {
      var vs = this._getResourcesFromPackageStore("ValueSet", item.answerValueSet)
      if (vs && this._fhir) {
        var answers = this._fhir.SDC.answersFromVS(vs.fileContent);
        if (answers) {
          item.answers = answers;
        }
      }
    }
  }


  /**
   *  Checks that the given variable name is allowed in FHIR and throws an
   *  exception if it is not.
   */
  _checkFHIRVarName(name) {
    if (this._fhir.reservedVarNames[name]) {
      throw 'The "'+name+'" variable name is reserved; Questionnaires may not '+
        'assign a value to it.';
    }
  }


  /**
   * Calculate internal data from the raw form definition data,
   * including:
   * structural data:
   *    _id, _idPath
   * data for widget control and/or performance improvement:
   *    _displayLevel
   * @private
   */
  _initializeInternalData() {
    //TODO, validate form data

    // set default values of certain form definition fields
    this._setDefaultValues();

    LhcFormUtils.initializeCodes(this);
    // update internal status
    this._repeatableItems = {};
    this._setTreeNodes(this.items, this);
    this._updateLastRepeatingItemsStatus(this.items);

    // create a reference list of all items in the tree
    this.itemList = [];
    this.itemHash = {};
    this._updateItemReferenceList(this.items);

    this._standardizeScoreRule(this.itemList);

    // create horizontal table info
    this._resetHorizontalTableInfo();
    this._adjustLastSiblingListForHorizontalLayout();

    //// TODO
    // create a navigation map
    //Navigation.setupNavigationMap(this);

    // create auto-completer options and assign field default values
    this._setUpAnswerAndUnitAutoComp(this.itemList);

    // set up a mapping from controlling items to controlled items
    // for skip logic, data controls and formulas
    this._setupSourceToTargetMap();

    // run the form controls
    this._checkFormControls();

  }


  /**
   * Reset internal structural data when repeatable items/groups are added or removed.
   * @private
   */
  _resetInternalData() {

    // update internal status
    this._updateTreeNodes(this.items,this);
    this._updateLastRepeatingItemsStatus(this.items);

    // create a reference list of all items in the tree
    this.itemList = [];
    this.itemHash = {};
    this._updateItemReferenceList(this.items);

    this._standardizeScoreRule(this.itemList);

    // create horizontal table info
    this._resetHorizontalTableInfo();
    this._adjustLastSiblingListForHorizontalLayout();

    //// TODO
    // // create a navigation map
    // this.Navigation.setupNavigationMap(this);

    // create auto-completer options
    this._setUpAnswerAndUnitAutoComp(this.itemList);

    // set up a mapping from controlling items to controlled items
    // for skip logic, data controls and formulas
    this._setupSourceToTargetMap();

    // run the all form controls
    this._checkFormControls();
  }


  /**
   * Recursively update skip logic status of a source item, and apply any process,
   * typically update formulas or data control values.
   *
   * @param sourceItem - LFormsData of a source item.
   * @param processItem - A call back function with signature:
   *      function(item): item - Updated LFormsData of traversed item.
   * @return {boolean} whether the skip logic status has changed
   */
  updateSkipLogicControlledItems(sourceItem, processItem) {
    var changed = false;
    // check skip logic
    if(sourceItem._skipLogicTargets) {
      for (var i= 0, iLen=sourceItem._skipLogicTargets.length; i<iLen; i++) {
        var targetItem = sourceItem._skipLogicTargets[i];
        changed = this._updateItemSkipLogicStatus(targetItem, null) || changed;
        changed = this.updateSkipLogicControlledItems(targetItem, processItem) || changed;
      }
    }
    changed = processItem(sourceItem) || changed;
    return changed;
  }


  /**
   * Check skip logic, formulas and data controls when the source item changes.
   * @param sourceItem the controlling/source item
   */
  updateOnSourceItemChange(sourceItem) {
    var _self = this;
    var changed = true;
    while(changed) {
      changed = this.updateSkipLogicControlledItems(sourceItem, function(item) {
        var chged = false;
        // check formula
        if(item._formulaTargets) {
          for (var i= 0, iLen=item._formulaTargets.length; i<iLen; i++) {
            var targetItem = item._formulaTargets[i];
            chged = _self._processItemFormula(targetItem) || chged;
          }
        }
        // check data control
        if(item._dataControlTargets) {
          for (var i= 0, iLen=item._dataControlTargets.length; i<iLen; i++) {
            var targetItem = item._dataControlTargets[i];
            chged = _self._processItemDataControl(targetItem) || chged;
          }
        }
        return chged;
      });
    }

    // update internal status
    this._updateTreeNodes(this.items,this);
    this._updateLastRepeatingItemsStatus(this.items);
    this._resetHorizontalTableInfo();
    this._adjustLastSiblingListForHorizontalLayout();

    // run FHIRPath expression
    if (LForms.FHIR && this._hasResponsiveExpr) {
      let self = this;
      setTimeout(function(){
        self._expressionProcessor.runCalculations(false).then(()=>{            
          self._checkFormControls();
        });
      });
    }
  }


  /**
   * Validate user input value
   * This might be used in the future.
   * @param item the question item
   * @private
   */
  _checkValidations(item) {
    if (item._hasValidation) {
      var errors = [];
      var errorRequired = Validation.checkRequired(item._answerRequired, item.value, errors);
      var errorDataType = Validation.checkDataType(item.dataType, item.value, errors);
      var errorRestrictions = Validation.checkRestrictions(item.restrictions, item.value, errors);
      item._validationErrors = errors;

    }
  }


  /**
   * run all form controls when a form data is initially loaded.
   * @private
   */
  _checkFormControls() {

    var changed = true;

    while (changed) {
      changed = false;
      for (var i=0, iLen=this.itemList.length; i<iLen; i++) {
        var item = this.itemList[i];

        // run formula
        if (item.calculationMethod) {
          changed = this._processItemFormula(item) || changed;
        }
        // run data control
        if (item.dataControl) {
          changed = this._processItemDataControl(item) || changed;
        }
        // run skip logic
        if (item.skipLogic) {
          changed = this._updateItemSkipLogicStatus(item, null) || changed;
        }
        // Hide the sub items if isHiddenInDef flag is true.
        if (item.isHiddenInDef) {
          if (!item._isHiddenFromView) changed = true;
          item._isHiddenFromView = true;
          changed = this._setSubItemsHidden(item) || changed;
        }
      }
    }

    // update internal status
    this._updateTreeNodes(this.items,this);
    this._updateLastRepeatingItemsStatus(this.items);
    this._resetHorizontalTableInfo();
    this._adjustLastSiblingListForHorizontalLayout();
  }


  /**
   * Update sub items if the current item is hidden
   * @param item the item that is hidden
   * @return {boolean} whether the item._isHiddenFromView has changed
   */
  _setSubItemsHidden(item) {
    var changed = false;
    // process the sub items
    if (item.items && item.items.length > 0) {
      for (var i=0, iLen=item.items.length; i<iLen; i++) {
        var subItem = item.items[i];
        if (!subItem._isHiddenFromView) changed = true;
        subItem._isHiddenFromView = true;
        changed = this._setSubItemsHidden(subItem) || changed;
      }
    }
    return changed;
  }


  /**
   * Set up a mapping between controlling/source items and target items on the controlling/source item
   * @private
   */
  _setupSourceToTargetMap() {
    for (var i=0, iLen=this.itemList.length; i<iLen; i++) {
      var item = this.itemList[i];
      // formula
      if (item.calculationMethod && item.calculationMethod.name) {
        var sourceItems = this._getFormulaSourceItems(item, item.calculationMethod.value);
        for(var j= 0, jLen=sourceItems.length; j<jLen; j++) {
          if (sourceItems[j]._formulaTargets) {
            sourceItems[j]._formulaTargets.push(item);
          }
          else {
            sourceItems[j]._formulaTargets = [item];
          }
        }
      }
      // dataControl
      if (item.dataControl && Array.isArray(item.dataControl)) {
        for (var j= 0, jLen:number=item.dataControl.length; j<jLen; j++) {
          var source = item.dataControl[j].source;

          // has a source configuration
          if (source && (!source.sourceType || source.sourceType === CONSTANTS.DATA_CONTROL.SOURCE_INTERNAL) &&
              source.sourceLinkId) {
            // get the source item object
            var sourceItem = this._findItemByLinkId(item, source.sourceLinkId);
            if (!sourceItem) {
              // This is an error in the form definition.  Provide a useful
              // debugging message.
              throw new Error("Data control for item '" +item.question+ "' refers to source item '"+source.sourceLinkId+
                "' which was not found as a sibling, ancestor, or ancestor sibling.");
            }
            if (sourceItem._dataControlTargets) {
              sourceItem._dataControlTargets.push(item);
            }
            else {
              sourceItem._dataControlTargets = [item];
            }
          }
        }
      }
      // skip logic
      if (item.skipLogic) {
        for (var j= 0, jLen:number=item.skipLogic.conditions.length; j<jLen; j++) {
          var condition = item.skipLogic.conditions[j];
          var sourceItem = this._getSkipLogicSourceItem(item, condition.source);
          if (sourceItem._skipLogicTargets) {
            sourceItem._skipLogicTargets.push(item);
          }
          else {
            sourceItem._skipLogicTargets = [item];
          }
        }
      }
    }
  }


  /**
   * Update data by running the skip logic on the target item
   * @param item the target item where there is a skip logic
   * @param disabled if the parent item is already disabled
   * @return {boolean} whether the item.value has changed
   */
  _updateItemSkipLogicStatus(item, disabled) {
    var changed = false;
    var isDisabled;
    // if one item is hidden all of its decedents should be hidden.
    // not necessary to check skip logic, assuming 'hide' has the priority over 'show'
    if (disabled) {
      changed = this._setSkipLogicStatusValue(item, CONSTANTS.SKIP_LOGIC.STATUS_DISABLED) || changed;
      isDisabled = true;
    }
    // if the item is not hidden, show all its decedents unless they are hidden by other skip logic.
    else {
      if (item.skipLogic) {
        var takeAction = this._checkSkipLogic(item);

        if (!item.skipLogic.action || item.skipLogic.action === CONSTANTS.SKIP_LOGIC.ACTION_ENABLE) {
          var newStatus = takeAction ? CONSTANTS.SKIP_LOGIC.STATUS_ENABLED : CONSTANTS.SKIP_LOGIC.STATUS_DISABLED;
          changed = this._setSkipLogicStatusValue(item, newStatus) || changed;
        }
        else if (item.skipLogic.action === CONSTANTS.SKIP_LOGIC.ACTION_DISABLE) {
          var newStatus = takeAction ? CONSTANTS.SKIP_LOGIC.STATUS_DISABLED : CONSTANTS.SKIP_LOGIC.STATUS_ENABLED;
          changed = this._setSkipLogicStatusValue(item, newStatus) || changed;
        }
      }
      // if there's no skip logic, show it when it was hidden because one of its ancestors was hidden
      else if (item._skipLogicStatus === CONSTANTS.SKIP_LOGIC.STATUS_DISABLED) {
        changed = this._setSkipLogicStatusValue(item, CONSTANTS.SKIP_LOGIC.STATUS_ENABLED) || changed;
      }
      isDisabled = item._skipLogicStatus === CONSTANTS.SKIP_LOGIC.STATUS_DISABLED;
    }
    // process the sub items
    if (item.items && item.items.length > 0) {
      for (var i=0, iLen=item.items.length; i<iLen; i++) {
        var subItem = item.items[i];
        changed = this._updateItemSkipLogicStatus(subItem, isDisabled) || changed;
      }
    }

    return changed;
  }


  /**
   * Preset skip logic status for newly added repeating items
   * @param item an item
   * @param hide if the parent item is already hidden
   * @private
   */
  _presetSkipLogicStatus(item, hide) {
    // if it has skip logic or one of its ancestors has skip logic
    if (item.skipLogic || hide) {
      this._setSkipLogicStatusValue(item, CONSTANTS.SKIP_LOGIC.STATUS_DISABLED, true);
      var isDisabled = true;
      // process the sub items
      if (item.items) {
        for (var i=0, iLen=item.items.length; i<iLen; i++) {
          this._presetSkipLogicStatus(item.items[i], isDisabled);
        }
      }
    }
  }


  /**
   * Set the skip logic status value on an item and create a screen reader log
   * @param item an item
   * @param newStatus the new skip logic status
   * @param noLog optional, a flag that decides whether the action needs to be logged, default is false
   * @return {boolean} whether the item.value has changed
   * @private
   */
  _setSkipLogicStatusValue(item, newStatus, noLog=false) {
    var changed = false;
    if (item._skipLogicStatus !== newStatus) {
      if (item._skipLogicStatus) {
        var msg = newStatus === CONSTANTS.SKIP_LOGIC.STATUS_DISABLED ? 'Hiding ' + item._text : 'Showing ' + item._text;
        if (!noLog)
          this._actionLogs.push(msg);
      }
      item._preSkipLogicStatus = item._skipLogicStatus;
      item._skipLogicStatus = newStatus;
      changed = true;
    }
    return changed;
  }


  /**
   * Create a list of reference to the items in the tree
   * @param items sibling items on one level of the tree
   * @private
   */
  _updateItemReferenceList(items) {

    for (var i=0, iLen=items.length; i<iLen; i++) {
      var item = items[i];
      this.itemList.push(item);
      this.itemHash[item._elementId] = item;
      // process the sub items
      if (item.items && item.items.length > 0) {
        this._updateItemReferenceList(item.items);
      }
    }
  }


  /**
   * Find all the items across the form that have scores
   * @returns {string[]} items that have a score value on answers
   * @private
   */
  _findItemsWithScore() {

    var itemsWithScore = {};

    // check siblings
    for (var i=0, iLen=this.itemList.length; i<iLen; i++) {
      var sourceItem = this.itemList[i];
      // it has an answer list
      if ((sourceItem.dataType === 'CNE' || sourceItem.dataType === 'CWE') &&
          sourceItem.answers && Array.isArray(sourceItem.answers) && sourceItem.answers.length > 0) {
        // check if any one of the answers has a score
        for (var j = 0, jLen = sourceItem.answers.length; j < jLen; j++) {
          var answer = sourceItem.answers[j];
          if (answer && answer.hasOwnProperty('score') && !isNaN(answer.score)) {
            itemsWithScore[sourceItem.linkId] = sourceItem;
            break;
          }
        } // end of answers loop
      } // end if there's an answer list
    }
    return Object.keys(itemsWithScore);
  }


  /**
   * Convert the score rule definition to the standard formula definition
   * @param itemList the reference list of the items in the tree
   * @private
   */
  _standardizeScoreRule(itemList) {
    for (var i=0, iLen=itemList.length; i<iLen; i++) {
      var totalScoreItem = itemList[i];

      if (totalScoreItem.calculationMethod &&
        (totalScoreItem.calculationMethod.name === CONSTANTS.CALCULATION_METHOD.TOTALSCORE ||
        totalScoreItem.calculationMethod === CONSTANTS.CALCULATION_METHOD.TOTALSCORE) ) {
        // TBD, if the parameters values are already supplied,
        totalScoreItem.calculationMethod = {"name": CONSTANTS.CALCULATION_METHOD.TOTALSCORE, "value": []};

        var itemsWithScore = this._findItemsWithScore();
        totalScoreItem.calculationMethod.value = itemsWithScore;
      }
    }
  }


  /**
   * Set default values if the data is missing.
   * @private
   */
  _setDefaultValues() {

    this._codePath = "";
    this._idPath = "";
    this._displayLevel = 0;
    this._activeItem = null;

    // add a link to external site for item's definition
    if (this.codeSystem === "LOINC") {
      this._linkToDef = "http://s.details.loinc.org/LOINC/" + this.code + ".html";
    }

    // template
    if (!this.template || this.template.length == 0 ||
        this.template === "form-view-a" || this.template === "form-view-b") {
      this.template = "table";
    }

    // templateOptions
    // make a copy of the existing options of the form data
    var currentOptions = CommonUtils.deepCopy(this.templateOptions);
    var defaultOptions = CommonUtils.deepCopy(this._defaultTemplateOptions);

    this.setTemplateOptions(currentOptions, defaultOptions);

  }


  /**
   * Merge two arrays of objects.
   * Any object or field value that is null are skipped.
   * Note: Used in setTemplateOptions only. Not supposed to be used by other functions.
   * @param array1 the array where data are merged to
   * @param array2 the array where data are merged from.
   * @private
   */
  _mergeTwoArrays(array1, array2) {
    for (var i= 0, iLen = array2.length; i<iLen; i++) {
      // if the element is not null or undefined
      if (array2[i]) {
        var fields = Object.keys(array2[i]);
        for (var j= 0, jLen=fields.length; j<jLen; j++) {
          // if the value is not null or undefined
          if (array2[i][fields[j]] !== null || array2[i][fields[j]] !==undefined) {
            // update the value on the field in array 1.
            // no duplicated LForms.Util.deepCopy here on the value if array2 contains copies of the objects already
            array1[i][fields[j]] = array2[i][fields[j]];
          }
        }
      }
    }
  }


  /**
   * Set template options
   * @param newOptions new options to be merged with existing options
   * @param existingOptions existing options in the form data
   */
  setTemplateOptions(newOptions, existingOptions=null) {
    if (newOptions) {
      if (!existingOptions)
        existingOptions = CommonUtils.deepCopy(this.templateOptions);

      // check if displayScoreWithAnswerText is changed
      let scoreFlagChanged = newOptions.displayScoreWithAnswerText !== undefined && 
          newOptions.displayScoreWithAnswerText !== existingOptions.displayScoreWithAnswerText;

      // merge the options
      this.templateOptions = Object.assign({}, existingOptions, newOptions);

      // recreate the answerOption to add or remove the scores from display texts
      if (scoreFlagChanged) {
        for (let i=0, iLen=this.itemList.length; i<iLen; i++) {
          let item = this.itemList[i];
          if (!!item._hasAnswerList && item._hasScoreInAnswer)
            this._updateAutocompOptions(item);
        }
      }

      this.setMessageLevel(this.templateOptions.messageLevel);
    }
  }


  /**
   * Assign the given item's defaultAnswer as its value, potentially with data type conversion/transformation.
   * For now, only converting DT/DTM string to a date object. The assignment happens only if item.defaultAnswer
   * is not undefined, null, or empty string.
   * @param item the lforms item to assign value to (from its defaultAnswer)
   * @private
   */
  _lfItemValueFromDefaultAnswer(item) {
    var value = item.defaultAnswer;
    if(value === undefined || value === null || value === '') {
      return false;
    }
    if(!item._hasAnswerList && (item.dataType === CONSTANTS.DATA_TYPE.DTM
        || item.dataType === CONSTANTS.DATA_TYPE.DT) && typeof value === 'string') {
      value = CommonUtils.stringToDate(value);
      if(! value) { // LForms.Util.stringToDate returns null on invalid string
        //TODO: should save the errors or emitting events.
        console.error(item.defaultAnswer + ': Invalid date/datetime string as defaultAnswer for ' + item.questionCode);
      }
    }

    InternalUtil.assignValueToItem(item, value);
  }


  /**
   * Set up the internal data for each item in the tree
   * @param items sibling items on one level of the tree
   * @param parentItem the parent item
   * @private
   */
  _setTreeNodes(items, parentItem) {
    var iLen=items.length, lastSiblingIndex = iLen -1;
    var prevSibling = null, itemId = 1;

    // for each item on this level
    for (var i=0; i<iLen; i++) {
      var item = items[i];

      LhcFormUtils.initializeCodes(item);

      // set display text for the item
      item._text = item.prefix ? item.prefix + " " + item.question : item.question;

      // set default dataType
      // TODO: header is kept for backward compatibility. it should not be used any more.
      if (item.header) {
        if (item.dataType !== CONSTANTS.DATA_TYPE.TITLE)
          item.dataType = CONSTANTS.DATA_TYPE.SECTION;
      }
      else {
        // set data type for items with units (for unified display styles)
        if (item.units && !item.dataType) {
          item.dataType = CONSTANTS.DATA_TYPE.REAL;
        }
        else if(!item.dataType)
          item.dataType = CONSTANTS.DATA_TYPE.ST; // default data type
      }

      // reset answers if it is an answer list id
      if (((typeof item.answers) === 'string' || (typeof item.answers) === 'number') &&
          this.answerLists && Array.isArray(this.answerLists[item.answers])) {
        item.answers = this.answerLists[item.answers];
      }

      // if a resource package is provided
      if (this._packageStore) {
        this._loadAnswerValueSetsFromPackage(item);
      }

      // check if the item has an answer list or a search url
      item._hasAnswerList = InternalUtil.hasAnswerList(item);
    
      // displayControl default values
      if (item.dataType === "SECTION") {
        if (!item.displayControl) {
          item.displayControl = {"questionLayout": "vertical"};
          if (item.layout) {
            // rename layout for backward compatibility
            item.displayControl.questionLayout = item.layout;
            delete item.layout;
          }
        }
        else if (!item.displayControl.questionLayout) {
          item.displayControl.questionLayout = "vertical";
        }
      }
      else if (item._hasAnswerList) {
        if (!item.displayControl) {
          item.displayControl = CommonUtils.deepCopy(this.templateOptions.defaultAnswerLayout);
        }
        else if (!item.displayControl.answerLayout) {
          item.displayControl.answerLayout =CommonUtils.deepCopy(this.templateOptions.defaultAnswerLayout.answerLayout);
        }
      }

      if (item.extension && this._fhir) {
        this._fhir.SDC.buildExtensionMap(item);
        this._hasResponsiveExpr = this._hasResponsiveExpr ||
          this._fhir.SDC.hasResponsiveExpression(item);
        this._hasInitialExpr = this._hasInitialExpr ||
          this._fhir.SDC.hasInitialExpression(item);
        item._hasListExpr =
          this._fhir.SDC.hasListExpression(item);
      }

      this._updateItemAttrs(item);

      // If there are answers for an answer list and there is a value, replace
      // the value objects with the corresponding objects from the answer list,
      // so that when they are displayed as radio buttons, angular will recognize the
      // one or more answer options as equal to the values.

      // reset item.value with modified answers if the item has a value (or an array of values)
      if (item._hasAnswerList) {
        this._resetItemValueWithAnswers(item);
      }
      // if this is not a saved form with user data, and
      // there is a default value, and
      // there is no embedded data
      else if (!this.hasSavedData && item.defaultAnswer !== undefined && item.defaultAnswer !== null &&
        (item.value === undefined || item.value === null)) {
        this._lfItemValueFromDefaultAnswer(item);
      }

      // id
      if (item._questionRepeatable && prevSibling && prevSibling.linkId === item.linkId) {
        itemId += 1;
      }
      else {
        itemId = 1;
      }
      item._id = itemId;

      item._idPath = parentItem._idPath + this.PATH_DELIMITER + item._id;
      item._elementId = item.linkId + item._idPath;
      item._displayLevel = parentItem._displayLevel + 1;

      // set last sibling status
      item._lastSibling = i === lastSiblingIndex;
      // set the first sibling status
      item._firstSibling = i === 0;

      // set up placeholders
      this._setupInFieldPlaceholders(item);

      // convert date string to Date object
      if (item.value && !item._hasAnswerList && (item.dataType === CONSTANTS.DATA_TYPE.DT || 
          item.dataType === CONSTANTS.DATA_TYPE.DTM)) {
        item.value = CommonUtils.stringToDate(item.value);
      }
      // internally all numeric values are of string type
      if (!item._hasAnswerList && (item.dataType === CONSTANTS.DATA_TYPE.INT || 
        item.dataType === CONSTANTS.DATA_TYPE.REAL ||
        item.dataType === CONSTANTS.DATA_TYPE.QTY) &&
        typeof item.value === "number") {
          item.value = item.value + "";
      }

      // set up validation flag
      if (item._answerRequired ||
          item.restrictions ||
          (item.dataType !== CONSTANTS.DATA_TYPE.ST &&
            item.dataType !== CONSTANTS.DATA_TYPE.TX &&
            item.dataType !== CONSTANTS.DATA_TYPE.DTM &&
            item.dataType !== CONSTANTS.DATA_TYPE.DT &&
            item.dataType !== CONSTANTS.DATA_TYPE.TM &&
            !item._hasAnswerList)) {
        item._hasValidation = true;
      }

      // add a link to external site for item's definition
      if (item.questionCodeSystem === "LOINC" || (this.codeSystem === "LOINC" && !item.questionCodeSystem)) {
        item._linkToDef = "http://s.details.loinc.org/LOINC/" + item.questionCode + ".html";
      }

      // process the sub items
      if (item.items && item.items.length > 0) {
        this._setTreeNodes(item.items, item);
      }

      // keep a copy of the repeatable items, only for the first of the same repeating items
      // before the parentItem is added to avoid circular reference that make the LForms.Util.deepCopy really slow
      // Note: this must be processed after its sub items are processed.
      if (item._questionRepeatable && item._id === 1) {
        // remove _parentItem if there is one
        delete item._parentItem;
        var itemRepeatable = CommonUtils.deepCopy(item);
        // remove user data
        this._removeUserDataAndRepeatingSubItems(itemRepeatable);
        this._repeatableItems[item.linkId] = itemRepeatable;
      }
      // set a reference to its parent item
      item._parentItem = parentItem;

      // keep a reference to the previous item for checking repeating items.
      prevSibling = item;

    }
  }


  /**
   * Set up tool tip for an item.
   * Tool tips are usually displayed as in-field hints.
   * @param item an item
   */
  _setupInFieldPlaceholders(item) {
    // set up placeholder and process user data if there's any user data.
    if (!item._readOnly) {
      // use entryFormat if there is one imported from the Questionnaire resource
      if (item._entryFormat) {
        item._placeholder = item._entryFormat;
      }
      // autocomplete
      else if (item._hasAnswerList) {
        if (item.dataType === CONSTANTS.DATA_TYPE.CWE) {
          if (item.externallyDefined)
            item._placeholder = item._multipleAnswers ? "Suchen oder Werte eingeben" : "Suchen oder Wert eingeben";
          else
            item._placeholder = item._multipleAnswers ? "Auswählen oder Werte eingeben" : "Auswählen oder Wert eingeben";
        }
        // INT, ST, DT, TM and CNE
        else {
          if (item.externallyDefined)
            item._placeholder = "Suchen";
          else
            item._placeholder = "Auswählen";          
        }
      }
      // other types
      else {
        switch (item.dataType) {
          case CONSTANTS.DATA_TYPE.DT:
            item._placeholder = "TT.MM.JJJJ";
            break;
          case CONSTANTS.DATA_TYPE.DTM:
            item._placeholder = "TT.MM.JJJJ HH:MM:SS";
            break;
          case CONSTANTS.DATA_TYPE.TM:
            item._placeholder = "HH:MM:SS";
            break;
          case CONSTANTS.DATA_TYPE.CNE:
            if (item.externallyDefined)
              item._placeholder = "Suchen";
            else
              item._placeholder = "Auswählen";
            break;
          case CONSTANTS.DATA_TYPE.CWE:
            if (item.externallyDefined)
              item._placeholder = item._multipleAnswers ? "Suchen oder Werte eingeben" : "Suchen oder Wert eingeben";
            else
              item._placeholder = item._multipleAnswers ? "Auswählen oder Werte eingeben" : "Auswählen oder Wert eingeben";
            break;
          case "SECTION":
          case "TITLE":
          case "":
            item._placeholder = "";
            break;
          case CONSTANTS.DATA_TYPE.INT:
          case CONSTANTS.DATA_TYPE.REAL:
          case CONSTANTS.DATA_TYPE.QTY:
            item._placeholder = "Zahl eingeben";
            break;
          default: {
            item._placeholder = "Wert eingeben";
          }
        }
      }
    }
  }


  /**
   * Remove user data and the repeating sub items (except for the first one)
   * on an item or on all its sub items
   * @param item an item
   * @private
   */
  _removeUserDataAndRepeatingSubItems(item) {
    item.value = null;
    item.unit = null;
    if (item.items && item.items.length > 0) {
      for (var i=0; i<item.items.length; i++) {
        var subItem = item.items[i];
        if (subItem._questionRepeatable && subItem._id != 1) {
          item.items.splice(i, 1);
          i--;
        }
        else {
          this._removeUserDataAndRepeatingSubItems(subItem);
        }

      }
    }
  }


  /**
   *  Sets some tree node attributes which need to be updated by both _setTreeNodes
   *  and _updateTreeNodes.
   * @param item the item whose attributes need to set or updated.
   */
  _updateItemAttrs(item) {
    // set default values on the item
    // questionCardinality
    if (!item.questionCardinality) {
      item.questionCardinality = {"min":"1", "max":"1"};
    }
    // answerCardinality
    if (!item.answerCardinality) {
      item.answerCardinality = {"min":"0", "max":"1"};
    }

    if (!Array.isArray(item.answers) && item.answers !== "" && this.answerLists) {
      item.answers = this.answerLists[item.answers];
    }

    // process the answer code system
    if (Array.isArray(item.answers) && (item.dataType === CONSTANTS.DATA_TYPE.CNE || 
        item.dataType === CONSTANTS.DATA_TYPE.CNE)) {
      var answerCodeSystem = item.answerCodeSystem ? LhcFormUtils.getCodeSystem(item.answerCodeSystem) : null;
      for (var i=0, iLen = item.answers.length; i<iLen; i++) {
        var answer = item.answers[i];
        // if there is a 'system'
        if (answer.system) {
          // convert system to the standard one in case it is 'LOINC'
          answer.system = LhcFormUtils.getCodeSystem(answer.system);
        }
        else {
          // convert 'codeSystem' to 'system'. support 'codeSystem' for backward compatibility.
          if (answer.codeSystem) {
            answer.system = LhcFormUtils.getCodeSystem(answer.codeSystem);
            delete answer.codeSystem;
          // use item level answer code system
          } else if (answerCodeSystem) {
            answer.system = answerCodeSystem;
          }
        }
      }
    }

    // set up flags for question and answer cardinality
    item._questionRepeatable = item.questionCardinality.max &&
        (item.questionCardinality.max === "*" || parseInt(item.questionCardinality.max) > 1);
    item._answerRequired = item.answerCardinality.min &&
        (item.answerCardinality.min && parseInt(item.answerCardinality.min) >= 1);
    item._multipleAnswers = LhcFormUtils._hasMultipleAnswers(item);

    // set up readonly flag
    item._readOnly = (item.editable && item.editable === "0") ||
      !!item.calculationMethod;

    if (this._fhir) {
      this._fhir.SDC.processExtensions(item, 'obj_text');
      this._fhir.SDC.processExtensions(item, 'obj_prefix');
    }
  }


  /**
   *  Returns true if the item is hidden for any reason.
   */
  _isHidden(item) {
    return item._skipLogicStatus === CONSTANTS.SKIP_LOGIC.STATUS_DISABLED || item._isHiddenFromView ||
      item._enableWhenExpVal === false;
  }


  /**
   * Update the internal data for each item in the tree when items are added or removed or the values change
   * @param items sibling items on one level of the tree
   * @param parentItem the parent item
   * @private
   */
  _updateTreeNodes(items, parentItem) {
    // for each item on this level
    var iLen=items.length, lastSiblingIndex = iLen -1;
    var foundLastSibling = false;
    for (var i=iLen-1; i>=0; i--) {
      var item = items[i];
      if (!item._id) item._id = 1;

      item._idPath = parentItem._idPath + this.PATH_DELIMITER + item._id;
      item._elementId = item.linkId + item._idPath;
      item._displayLevel = parentItem._displayLevel + 1;
      item._parentItem = parentItem;
      item._repeatingSectionList = null;

      this._updateItemAttrs(item);

      // set the last sibling status
      item._lastSibling = i === lastSiblingIndex;

      // consider if the last sibling is hidden by skip logic, or is hidden by a FHIR extension
      if (!foundLastSibling) {
        if (this._isHidden(item)) {
          item._lastSibling = false;
          lastSiblingIndex -= 1;
        }
        else {
          item._lastSibling = true;
          foundLastSibling = true;
        }
      }

      // keep a copy of the repeatable items, only for the first of the same repeating items
      // before the parentItem is added to avoid circular reference that make the LForms.Util.deepCopy really slow
      if (item._questionRepeatable && item._id === 1 && !this._repeatableItems[item.linkId]) {
        delete item._parentItem;
        var itemRepeatable = CommonUtils.deepCopy(item);
        // remove user data
        this._removeUserDataAndRepeatingSubItems(itemRepeatable);
        this._repeatableItems[item.linkId] = itemRepeatable;
      }
      item._parentItem = parentItem;

      // process the sub items
      if (item.items && item.items.length > 0) {
        this._updateTreeNodes(item.items, item);
      }
    }

    // check first sibling status
    var foundFirstSibling = false;
    var firstSiblingIndex = 0;
    for (var i=0; i<iLen; i++) {
      var item = items[i];
      // set the first sibling status
      item._firstSibling = i === firstSiblingIndex;

      // consider if the first sibling is hidden by skip logic
      if (!foundFirstSibling) {
        if (item._skipLogicStatus === CONSTANTS.SKIP_LOGIC.STATUS_DISABLED ) {
          item._firstSibling = false;
          firstSiblingIndex += 1;
        }
        else {
          item._firstSibling = true;
          foundFirstSibling = true;
        }
      }
    }
  }


  /**
   * Get the complete form definition data, including the user input data from the form.
   * The returned data could be fed into a LForms widget directly to render the form.
   * @param noEmptyValue optional, to remove items that have an empty value, the default is false.
   * @param noDisabledItem optional, to remove items that are disabled by skip logic, the default is false.
   * @param keepId optional, to keep _id field on item, the default is false
   * @return {{}} form definition JSON object
   */
  getFormData(noEmptyValue, noDisabledItem, keepId) {

    // get the form data
    var formData = this.getUserData(false, noEmptyValue, noDisabledItem, keepId);

    // check if there is user data
    var hasSavedData = false;
    for (var i=0, iLen=this.itemList.length; i<iLen; i++) {
      var item = this.itemList[i];
      if (!LhcFormUtils.isItemValueEmpty(item.value)) {
        hasSavedData = true;
        break;
      }
    }

    var defData:any = {
      lformsVersion: this.lformsVersion,
      PATH_DELIMITER: this.PATH_DELIMITER,
      code: this.code,
      codeList: this.codeList,
      identifier: this.identifier,
      codeSystem: this.codeSystem,
      name: this.name,
      type: this.type,
      template: this.template,
      copyrightNotice: this.copyrightNotice,
      items: formData.itemsData,
      templateOptions: CommonUtils.deepCopy(this.templateOptions)
    };

    if (this.extension && this.extension.length > 0) {
      defData.extension = this.extension;
    }
    if (hasSavedData) {
      defData.hasSavedData = true;
    }
    // keep the fhirVersion if it was converted from a Questionnaire
    if (this.fhirVersion) {
      defData.fhirVersion = this.fhirVersion;
    }

    return defData;
  }


  /**
   * Get user input data from the form, with or without form definition data.
   * @param noFormDefData optional, to not include form definition data, the default is false.
   * @param noEmptyValue optional, to remove items that have an empty value, the default is false.
   * @param noDisabledItem optional, to remove items that are disabled by skip logic, the default is false.
   * @param keepId optional, to keep _id field on item, the default is false
   * @returns {{itemsData: (*|Array), templateData: (*|Array)}} form data and template data
   */
  getUserData(noFormDefData, noEmptyValue, noDisabledItem, keepId) {
    var ret:any = {};
    this._invalidData = false;
    // check the value on each item and its subtree
    this._checkSubTreeValues(this.items);
    ret.itemsData = this._processDataInItems(this.items, noFormDefData, noEmptyValue, noDisabledItem,
        keepId);
    // return a deep copy of the data
    return CommonUtils.deepCopy(ret);
  }


  /**
   * Get a list of errors preventing the form from being valid.
   * @returns {Array<string> | null} list of errors or null if no errors
   */
  checkValidity () {
    const errors = [];
    const itemListLength = this.itemList.length;

    for (let i = 0; i < itemListLength; i++) {
      const item = this.itemList[i];

      if (item._skipLogicStatus !== CONSTANTS.SKIP_LOGIC.STATUS_DISABLED) {
        this._checkValidations(item);

        if (item._validationErrors !== undefined && item._validationErrors.length) {
          const errorDetails = item._validationErrors.map((e) => `${item.question} ${e}`);

          Array.prototype.push.apply(errors, errorDetails);
        }
      }
    }

    if (errors.length) {
      return errors;
    } else {
      return null;
    }
  }


  /**
   * Check the value on each item and set a _itemOrSubtreeHasValue flag
   * @param items an array of items
   */
  _checkSubTreeValues(items) {
    for (var i=0, iLen=items.length; i<iLen; i++) {
      this._setSubTreeHasValue(items[i]);
    }
  }


  /**
   * Set a _itemOrSubtreeHasValue flag on each item
   * item._itemOrSubtreeHasValue is true if the item or any item in its subtree has value.
   * @param item an item
   */
  _setSubTreeHasValue(item) {
    var hasValue = false;

    if (!LhcFormUtils.isItemValueEmpty(item.value)) {
      hasValue = true;
    }
    if (item.items && item.items.length > 0) {
      for (var i=0, iLen=item.items.length; i<iLen; i++) {
        var subHasValue = this._setSubTreeHasValue(item.items[i]);
        if (subHasValue)
          hasValue = true;
      }
    }
    item._itemOrSubtreeHasValue = hasValue;
    return hasValue;
  }


  /**
   * Process each item on each level of the tree structure when getting the user
   * data from the form.
   * @param items the items array
   * @param noFormDefData optional, to not include form definition data, the default is false.
   * @param noEmptyValue optional, to remove items that have an empty value, the default is false.
   * @param noDisabledItem optional, to remove items that are disabled by skip logic, the default is false.
   * @param keepId optional, to keep _id field on item, the default is false
   * @returns {Array} form data on one tree level
   * @private
   */
  _processDataInItems(items, noFormDefData, noEmptyValue, noDisabledItem, keepId) {
    var itemsData = [];
    for (var i=0, iLen=items.length; i<iLen; i++) {
      var item = items[i];
      var itemData:any = {};
      // for user typed data of a CWE item, it is in item.value as {text: "some other value", _notOnList: true}.

      // skip the item if the value is empty and the flag is set to ignore the items with empty value
      // or if the item is hidden and the flag is set to ignore hidden items
      if (noDisabledItem && item._skipLogicStatus === CONSTANTS.SKIP_LOGIC.STATUS_DISABLED ||
          noEmptyValue && !item._itemOrSubtreeHasValue && item.dataType!==CONSTANTS.DATA_TYPE.SECTION &&
          item.dataType!==CONSTANTS.DATA_TYPE.TITLE ) {
        continue;
      }
      // include only the code and the value (and unit, other value) if no form definition data is needed
      if (noFormDefData) {
        itemData.questionCode = item.questionCode;
        // not a group or title item
        if (item.dataType!==CONSTANTS.DATA_TYPE.SECTION && item.dataType!==CONSTANTS.DATA_TYPE.TITLE) {
          if (item.value !== undefined) itemData.value = this._getOriginalValue(item.value, item.dataType, item._hasAnswerList);
          if (item.unit) itemData.unit = this._getOriginalValue(item.unit);
        }
      }
      // otherwise include form definition data
      else {
        // process extensions
        if (item.extension && item.extension.length > 0) {
          itemData.extension = item.extension;
        }
        // Process other fields
        for (var field in item) {
          // special handling for user input values
          if (field === "value") {
            itemData[field] = this._getOriginalValue(item[field], item.dataType, item._hasAnswerList);
          }
          else if (field === "unit") {
            itemData[field] = this._getOriginalValue(item[field]);
          }
          // ignore the internal lforms data and angular data
          else if (!field.match(/^[_\$]/) && field !== 'extension') {
            itemData[field] = item[field];
          }
          if (keepId) {
            itemData["_id"] = item["_id"];
          }
        }
      }

      // process the sub items
      if (item.items && item.items.length > 0) {
        itemData.items = this._processDataInItems(item.items, noFormDefData, noEmptyValue, noDisabledItem, keepId);
      }
      // not to add the section header if noEmptyValue is set, and
      // all its children has empty value (thus have not been added either) or it has not children, and
      // it has an empty value (empty object, empty array)
      if (!noEmptyValue || (itemData.items && itemData.items.length !== 0) || item._itemOrSubtreeHasValue) {
        itemsData.push(itemData);
      }
    }
    return itemsData;
  }


  /**
   * Process values for a user selected/typed answer or unit.
   * Also remove internal data whose field/key names start with _.
   * @param obj either an answer object or a unit object
   * @param typeCWE optional, a flag indicates the item type is CWE, where data is
   * handled by autocomplete-lhc or radio buttons/checkboxes. default is false
   * @returns {{}}  a new object with the internal attributes removed.
   * @private
   */
  _filterInternalData(obj, typeCWE) {
    var objReturn = {};

    // special handling for the user-typed value for CWE data type
    if (typeCWE && obj._notOnList && !obj.code && !obj.system) {
      // return a string value
      objReturn = obj.text;
    }
    else {
      for (var field in obj) {
        if (!field.match(/^[_\$]/)) {
          objReturn[field] = obj[field];
        }
      }
    }
    return objReturn;
  }


  /**
   *  Returns an array of the current values for the given item.
   * @param lfItem the LFormsData item.
   * @return an array of the values for the given item.  The returned values may be part of
   *  the data model, and should not be changed.  For each repetition of the
   *  item, a value will be returned unless the value is empty.
   */
  getItemValues(lfItem) {
    var rtn;
    if (!lfItem._questionRepeatable) {
      var itemVal = lfItem.value;

      // Exclude empty values, because FHIRPath will only return the values that
      // are there.  (For example, in the RxTerms form, when there is no strength
      // list, the RxCUI variable expression comes back empty.)
      if (LhcFormUtils.isItemValueEmpty(itemVal))
        rtn = [];
      else
        rtn = lfItem._multipleAnswers ? itemVal : [itemVal]; // always return an array
    }
    else {
      rtn = [];
      var siblings = lfItem._parentItem.items;
      var linkId = lfItem.linkId;
      var foundLinkId = false;
      for (var i=0, len=siblings.length; i<len; ++i) {
        var s = siblings[i];
        if (s.linkId === linkId) {
          if (!LhcFormUtils.isItemValueEmpty(s.value))
            rtn.push(s.value);
          foundLinkId = true;
        }
        else if (foundLinkId) {
          // At this point the s.linkId has changed and we have left the repeating group
          break;
        }
      }
    }
    return rtn;
  }


  /**
   * Process value where it is an object or an array of objects
   * (when getting the user data from the form)
   * @param value the captured value
   * @param typeCWE optional, a flag indicates the item type is CWE, where data is
   * handled by autocomplete-lhc or radio buttons/checkboxes. default is false
   * @returns {*}
   * @private
   */
  _getObjectValue(value, typeCWE = false) {
    var retValue =null;
    if (value) {
      // an array
      if (Array.isArray(value)) {
        var answers = [];
        for (var j = 0, jLen = value.length; j < jLen; j++) {
          if (typeof value[j] === 'object') {
            answers.push(this._filterInternalData(value[j], typeCWE));
          }
          // for primitive data type
          else {
            answers.push(value[j]);
          }
        }
        retValue = answers;
      }
      // an object
      else if (typeof value === 'object') {
        retValue = this._filterInternalData(value, typeCWE);
      }
    }
    return retValue;
  }


  /**
   * Special handling for user input values, to get the original answer or unit object if there is one
   * (when getting the user data from the form)
   * @param value the data object of the selected answer
   * @param dataType optional, the data type of the value
   * @param hasAnswerList optional, a flag that indicates there is an answer list
   * @private
   */
  _getOriginalValue(value, dataType=null, hasAnswerList=false) {
    var retValue;
    if (value !== undefined && value !== null) {
      // has a data type
      if (dataType) {
        switch (dataType) {
          case CONSTANTS.DATA_TYPE.INT:   
            if (hasAnswerList) {
              retValue = value; // value is an object or an array of {text: value, ...}
            }
            else {
              if (Array.isArray(value)) {
                retValue = value.map(val => {
                  if (!CommonUtils.isInteger(val)) {
                    this._invalidData = true;
                  }
                  return parseInt(val)
                });
              }
              else {
                if (!CommonUtils.isInteger(value)) {
                  this._invalidData = true;
                }
                retValue = parseInt(value);
              }
            }
            break;
          case CONSTANTS.DATA_TYPE.REAL:
          case CONSTANTS.DATA_TYPE.QTY:
            if (!CommonUtils.isDecimal(value)) {
              this._invalidData = true;
            }
            retValue = parseFloat(value);
            break;
          case CONSTANTS.DATA_TYPE.DT:
            if (hasAnswerList) {
              retValue = value; // value is an object or an array of {text: value, ...}
            }
            else {
              retValue = Array.isArray(value) ? value.map(val=> CommonUtils.dateToDTStringISO(val)) : 
                CommonUtils.dateToDTStringISO(value);
            }
            break;
          case CONSTANTS.DATA_TYPE.DTM:
            retValue = CommonUtils.dateToDTMString(value);
            break;
          case CONSTANTS.DATA_TYPE.CNE:
            retValue = this._getObjectValue(value);
            break;
          case CONSTANTS.DATA_TYPE.CWE:
            // for CWE, it should handle the case where 'OTHER' is selected
            retValue = this._getObjectValue(value, true);
            break;
          case CONSTANTS.DATA_TYPE.BL:
            retValue = value ? true : false;
            break;
          case CONSTANTS.DATA_TYPE.ST:
          case CONSTANTS.DATA_TYPE.TM:            
            retValue = value; // value is an object or an array of {text: value} when hasAnswerList is true
            break;
          default:
            retValue = value;
        }
      }
      // it is for units when there is no dataType
      else {
        retValue = this._getObjectValue(value);
      }
    }
    return retValue;
  }


  /**
   * Get the max _id of the repeating item on the same level
   * @param item an item
   * @returns {number}
   */
  getRepeatingItemMaxId(item) {
    var maxId = item._id;
    if (item._parentItem && Array.isArray(item._parentItem.items)) {
      for (var i= 0, iLen=item._parentItem.items.length; i<iLen; i++) {
        if (item._parentItem.items[i].linkId === item.linkId &&
          item._parentItem.items[i]._id > maxId ) {
          maxId = item._parentItem.items[i]._id;
        }
      }
    }
    return maxId;
  }


  /**
   * Get the count of the repeating item on the same level
   * @param item an item
   * @returns {number}
   */
  getRepeatingItemCount(item) {
    var count = 0;
    if (item._parentItem && Array.isArray(item._parentItem.items)) {
      for (var i= 0, iLen=item._parentItem.items.length; i<iLen; i++) {
        if (item._parentItem.items[i].linkId === item.linkId) {
          count++;
        }
      }
    }
    return count;
  }


  /**
   * Update the last repeating item status on each item
   * @param items sibling items on one level of the tree
   * @private
   */
  _updateLastRepeatingItemsStatus(items) {
    if(!items || items.length === 0) {
      // Nothing to update. This allows to run the constructor on forms
      // with empty items, something FHIR Questionnaire supports.
      return;
    }

    var iLen = items.length;
    var prevLinkId = '';
    // process all items in the array except the last one
    for (var i=0; i<iLen; i++) {
      var item = items[i];
      if (prevLinkId !== '') {
        // it's a different item, and
        // previous item is a repeating item, set the flag as the last in the repeating set
        items[i - 1]._lastRepeatingItem = !!(prevLinkId !== item.linkId && items[i - 1]._questionRepeatable);
      }
      prevLinkId = item.linkId;
      // check sub levels
      if (item.items && item.items.length > 0) {
        this._updateLastRepeatingItemsStatus(item.items);
      }
    }
    // the last item in the array
    items[iLen - 1]._lastRepeatingItem = !!items[iLen - 1]._questionRepeatable;
    // check sub levels
    if (items[iLen-1].items && items[iLen-1].items.length > 0) {
      this._updateLastRepeatingItemsStatus(items[iLen-1].items);
    }

  }


  /**
   * Get the last item that will be displayed in a repeating section
   * @param item an item
   * @returns {*}
   * @private
   */
  _getLastSubItem(item) {
    var retItem = item;
    if (item && Array.isArray(item.items) && item.items.length > 0) {

      var lastItem, i = item.items.length, found = false;
      // found the last item that is not hidden
      do {
        lastItem = item.items[--i];
        if (lastItem._skipLogicStatus !== CONSTANTS.SKIP_LOGIC.STATUS_DISABLED) {
          found = true;
        }
      }
      while(!found);

      if (found) {
        retItem = this._getLastSubItem(lastItem);
      }
    }
    return retItem;
  }


  /**
   * Set up the internal data for handling the horizontal table
   * Note:
   * 1) "questionLayout" values 'horizontal','vertical' and 'matrix' are only set on items whose "header" is true
   * 2) any items within a 'horizontal' table must be a leaf node. i.e. it cannot contain any sub items.
   * 3) all items within a 'horizontal' table has it's "_inHorizontalTable" set to true.
   * 4) _repeatableItems is reused for adding a repeating row in a horizontal table. but the header item will not be added.
   * i.e. the table should not have more than one table title
   *
   * _horizontalTableInfo structure:
   * _horizontalTableInfo: {
   *    headerItem._horizontalTableId : {
   *      tableStartIndex: firstItemIndex (=== firstHeaderItemIndex === h1),
   *      tableEndIndex:   lastItemIndex,
   *      columnHeaders:   [ { label: item._text, id: 'col' + item._elementId, displayControl: item.displayControl },
   *                       ...],
   *      tableHeaders:    [headerItem1, headerItem2, ...]
   *      tableRows:       [{ header: headerItem1, cells : [rowItem11, rowItem12,...]},
   *                        { header: headerItem2, cells : [rowItem21, rowItem22,...]},
   *                       ... ],
   *      lastHeaderId:    lastHeaderId
   *    }
   *  }
   * @private
   */
  _resetHorizontalTableInfo() {

    this._horizontalTableInfo = {};

    var tableHeaderLinkIdAndParentIdPath = null;
    var lastHeaderId = null;

    for (var i= 0, iLen=this.itemList.length; i<iLen; i++) {
      var item = this.itemList[i];
      // section item and horizontal layout
      if (item.dataType===CONSTANTS.DATA_TYPE.SECTION && item.displayControl && item.displayControl.questionLayout == "horizontal" ) {
        // same methods for repeating items could be used for repeating and non-repeating items.
        // (need to rename function names in those 'repeatable' functions.)
        var itemsInRow = [];
        var columnHeaders = [];

        item._inHorizontalTable = true;
        var itemLinkIdAndParentIdPath = item.linkId + item._parentItem._idPath; // item._codePath + item._parentItem._idPath;
        lastHeaderId = item._elementId;
        // if it's the first row (header) of the first table,
        if (tableHeaderLinkIdAndParentIdPath === null ||
          tableHeaderLinkIdAndParentIdPath !== itemLinkIdAndParentIdPath) {
          // indicate this item is the table header
          tableHeaderLinkIdAndParentIdPath = itemLinkIdAndParentIdPath;
          item._horizontalTableHeader = true;
          item._horizontalTableId = tableHeaderLinkIdAndParentIdPath;

          itemsInRow = item.items;
          for (var j= 0, jLen=itemsInRow.length; j<jLen; j++) {
            var itemInRow = itemsInRow[j];
            columnHeaders.push({item: itemInRow, id: "col" + itemInRow._elementId, displayControl: itemInRow.displayControl});
            // indicate the item is in a horizontal table
            itemsInRow[j]._inHorizontalTable = true;
          }

          this._horizontalTableInfo[tableHeaderLinkIdAndParentIdPath] = {
            tableStartIndex: i,
            tableEndIndex: i+itemsInRow.length,
            columnHeaders: columnHeaders,
            tableRows: [{ header: item, cells : itemsInRow }],
            tableHeaders: [item]
          };

          // set the last table/row in horizontal group/table flag
          this._horizontalTableInfo[tableHeaderLinkIdAndParentIdPath]['lastHeaderId'] = lastHeaderId;
        }
        // if it's the following rows, update the tableRows and tableEndIndex
        else if (tableHeaderLinkIdAndParentIdPath === itemLinkIdAndParentIdPath ) {
          item._horizontalTableHeader = false;
          itemsInRow = item.items;
          for (var j= 0, jLen=itemsInRow.length; j<jLen; j++) {
            // indicate the item is in a horizontal table
            itemsInRow[j]._inHorizontalTable = true;
          }
          // update rows index
          this._horizontalTableInfo[tableHeaderLinkIdAndParentIdPath].tableRows.push({header: item, cells : itemsInRow});
          // update headers index (hidden)
          this._horizontalTableInfo[tableHeaderLinkIdAndParentIdPath].tableHeaders.push(item);
          // update last item index in the table
          this._horizontalTableInfo[tableHeaderLinkIdAndParentIdPath].tableEndIndex = i + itemsInRow.length;
          // set the last table/row in horizontal group/table flag
          this._horizontalTableInfo[tableHeaderLinkIdAndParentIdPath]['lastHeaderId'] = lastHeaderId;
        }
      }
    }
  }


  /**
   * Adjust the last sibling list for the first header item of horizontal tables
   * @private
   */
  _adjustLastSiblingListForHorizontalLayout() {
    var horizontalTables = this._horizontalTableInfo;

    for (var tableId in horizontalTables) {
      var tableHeaders = horizontalTables[tableId].tableHeaders;
      if (tableHeaders.length > 1) {
        // Pass the last header's last sibling status to the first header,
        // which is used for controlling the tree lines of the horizontal table.
        var firstTableHeader = tableHeaders[0];
        var lastTableHeader = tableHeaders[tableHeaders.length -1];
        firstTableHeader._lastSibling = lastTableHeader._lastSibling;
        ////firstTableHeader._lastSiblingList = lastTableHeader._lastSiblingList;
      }
    }
  }


  /**
   * Add a repeating item or a repeating section after the specified item
   * and update form status
   * @param item a repeating item or a repeating group item
   * @returns the newly added item or a header item of the newly added section
   */
  addRepeatingItems(item) {

    var maxRecId = this.getRepeatingItemMaxId(item);
    var newItem = CommonUtils.deepCopy(this._repeatableItems[item.linkId]);
    newItem._id = maxRecId + 1;

    if (item._parentItem && Array.isArray(item._parentItem.items)) {
      var insertPosition = 0;
      for (var i= 0, iLen=item._parentItem.items.length; i<iLen; i++) {
        if (item._parentItem.items[i].linkId === item.linkId &&
          item._parentItem.items[i]._id === item._id) {
          insertPosition = i;
          break;
        }
      }
      item._parentItem.items.splice(insertPosition + 1, 0, newItem);
      newItem._parentItem = item._parentItem;

      // preset the skip logic status to target-disabled on the new items
      this._presetSkipLogicStatus(newItem, false);
    }

    this._resetInternalData();

    var readerMsg = 'Hinzugefügt: ' + this.itemDescription(item);
    this._actionLogs.push(readerMsg);

    // run FHIRPath expression when a new item is added
    if (LForms.FHIR && this._hasResponsiveExpr) {
      this._expressionProcessor.runCalculations(false).then(()=>{});
    }

    return newItem;
  }


  /**
   *  Finds the index in the parent item array at which new repetitions of the
   *  given item should be added.
   * @param item a repeating item or a repeating group item
   * @return the index at which to add the repeating item.
   */
  _findIndexForNewRepetition(item) {
    var insertPosition = 0;
    var inRepeating = false;
    for (var i= 0, iLen=item._parentItem.items.length; i<iLen; i++) {
      if (item._parentItem.items[i].linkId === item.linkId) {
        inRepeating = true;
      }
      if (inRepeating && item._parentItem.items[i].linkId !== item.linkId) {
        insertPosition = i;
        break;
      }
    }
    // until the last item
    if (inRepeating && i===iLen) {
      insertPosition = i;
    }
    return insertPosition;
  }


  /**
   * Add a repeating item or a repeating section at the end of the repeating group
   * and update form status
   * @param item a repeating item or a repeating group item
   * @returns the newly added item or a header item of the newly added section
   */
  appendRepeatingItems(item) {

    var maxRecId = this.getRepeatingItemMaxId(item);
    var newItem = CommonUtils.deepCopy(this._repeatableItems[item.linkId]);
    newItem._id = maxRecId + 1;

    if (item._parentItem && Array.isArray(item._parentItem.items)) {
      var insertPosition = this._findIndexForNewRepetition(item);
      item._parentItem.items.splice(insertPosition, 0, newItem);
      newItem._parentItem = item._parentItem;

      // preset the skip logic status to target-disabled on the new items
      this._presetSkipLogicStatus(newItem, false);
    }

    this._resetInternalData();

    var readerMsg = 'Hinzugefügt: ' + this.itemDescription(item);
    this._actionLogs.push(readerMsg);

    return newItem;
  }


  /**
   * Check if any of the repeating item or group has no user input values.
   * @param item a repeating item or a repeating group item
   * @returns {boolean}
   */
  areAnyRepeatingItemsEmpty(item) {
    var anyEmpty = false;
    var repeatingItems = this._getRepeatingItems(item);
    for(var i=0, iLen=repeatingItems.length; i<iLen; i++) {
      // reset the message flag
      repeatingItems[i]._showUnusedItemWarning = false;
      // check if there is no user input for this item/section
      var empty = this._isRepeatingItemEmpty(repeatingItems[i]);
      if (empty) anyEmpty = true;
    }
    if (anyEmpty) {
      // set the flag to show the warning about unused repeating items
      item._showUnusedItemWarning = true;
    }
    return anyEmpty;
  }


  /**
   * Check if a repeating item has no user input value or
   * all items within a repeating group item have no user input values
   * @param item a repeating item or a repeating group item
   * @returns {boolean}
   */
  _isRepeatingItemEmpty(item) {

    var isEmpty = true;
    //
    if (item.dataType !== CONSTANTS.DATA_TYPE.SECTION) {
      if (item.value === undefined || item.value === null || item.value ==="") {
        return isEmpty;
      }
      // it's a question item, and it is not hidden
      if (item._skipLogicStatus !== CONSTANTS.SKIP_LOGIC.STATUS_DISABLED) {
        // multiple selection answer list (array is also an object)
        if (Array.isArray(item.value) && item.value.length > 0) {
          var notEmpty = false;
          for(var i= 0, iLen=item.value.length; i<iLen; i++) {
            if (item.value[i].text)
            notEmpty = item.value[i].text !== undefined && item.value[i].text !== null && item.value[i].text !=="";
            if (notEmpty) break;
          }
          isEmpty = !notEmpty;
        }
        // single selection answer, Date object or attachment
        else if (typeof item.value === 'object') {
          // An attachment should have either either value.data or value.url,
          const v = item.value;
          isEmpty = (v.data === undefined || v.data === null) && !v.url && // not an attachment
            !v.text && // !v.text means !(undefined or null or "")  // not an answer object
            !(v instanceof Date); // not a Date object (for DT and DTM. TM is a string in item.value)
        }
        // simple type
        else if (item.value !== undefined && item.value !== null && item.value !=="") {
          isEmpty = false;
        }
      }
    }

    // check sub items
    if (isEmpty && item.items) {
      for (var j= 0, jLen = item.items.length; j<jLen; j++) {
        isEmpty = this._isRepeatingItemEmpty(item.items[j]);
        if (!isEmpty) break;
      }
    }

    return isEmpty;
  }


  /**
   * Get a list of repeating items that the current item belongs to.
   * @param item the current item
   * @returns {Array}
   * @private
   */
  _getRepeatingItems(item) {
    var repeatingItems = [];
    if (item._questionRepeatable && item._parentItem && Array.isArray(item._parentItem.items)) {
      var items = item._parentItem.items;
      for (var i = 0, iLen = items.length; i < iLen; i++) {
        if (items[i].linkId === item.linkId) {
          repeatingItems.push(items[i]);
        }
      }
    }
    return repeatingItems;
  }


  /**
   * Get the sibling repeating item that is before the current item
   * @param item the current item
   * @returns {*} the previous item or null
   */
  getPrevRepeatingItem(item) {
    var repeatingItems = this._getRepeatingItems(item);
    var elementIDs = repeatingItems.map(function(it) {return it._elementId});
    var posIndex = elementIDs.indexOf(item._elementId);
    // return null if there is no items before this one
    return posIndex >0 ? repeatingItems[posIndex - 1] : null;
  }


  /**
   * Get the sibling repeating item that is after the current item
   * @param item the current item
   * @returns {*} the next item or null
   */
  getNextRepeatingItem(item) {
    var repeatingItems = this._getRepeatingItems(item);
    var elementIDs = repeatingItems.map(function(it) {return it._elementId});
    var posIndex = elementIDs.indexOf(item._elementId);
    // return null if there is no items after this one
    return posIndex < repeatingItems.length -1 ? repeatingItems[posIndex + 1] : null;
  }


  /**
   * Get the sibling repeating item that is the first one
   * @param item the current item
   * @returns {*} the first item
   */
  getFirstRepeatingItem(item) {
    var repeatingItems = this._getRepeatingItems(item);
    // always return the first one
    return repeatingItems[0];
  }


  /**
   * Get the sibling repeating item that is the last one
   * @param item the current item
   * @returns {*} the last item
   */
  getLastRepeatingItem(item) {
    var repeatingItems = this._getRepeatingItems(item);
    // always return the last one
    return repeatingItems[repeatingItems.length - 1];
  }


  /**
   *  Remove a repeating item or a repeating section and update form status
   * @param item an item
   */
  removeRepeatingItems(item) {

    if (item._parentItem && Array.isArray(item._parentItem.items)) {
      for (var i = 0, iLen = item._parentItem.items.length; i < iLen; i++) {
        if (item._parentItem.items[i].linkId == item.linkId &&
          item._parentItem.items[i]._id == item._id) {
          item._parentItem.items.splice(i, 1);
          break;
        }
      }
    }

    this._resetInternalData();
    var readerMsg = 'Entfernt: ' + this.itemDescription(item);
    this._actionLogs.push(readerMsg);

    // run FHIRPath expression when a new item is removed
    if (LForms.FHIR && this._hasResponsiveExpr) {
      this._expressionProcessor.runCalculations(false).then(()=>{});
    }
  }


  /**
   *  Adjusts the number of repeating items in order to accomodate the number of
   *  values in the given array, and assigns the items their values from the
   *  array.
   * @param item an item (possibly repeating) to which values are to be
   *  assigned.
   * @param vals an array of values to be assigned to item and its repetitions.
   *  If "item" does not support more than one value, an error will be logged if
   *  this array contains more than one value.
   * @param messages an Object whose key is a message source identifier and
   *  whose value is an array of message objects for each value.  See
   *  _convertFHIRValues for the format.
   * @param messageSource a string identifier for the source of these messages,
   *  to distinguish them from messages from other sources.
   * @return if the number if repetitions changes, this will return the new
   *  "last" repetition item; otherwise it will return undefined.
   */
  setRepeatingItems(item, vals, messages, messageSource) {
    var repetitionCountChanged = false;
    var repetitions;
    let messagesChanged = false;
    let valueChanged = false;
    if (!CommonUtils.deepEqual(item._lastComputedMessages, messages)) {
      item._lastComputedRepeatingMessages = messages;
      messagesChanged = true;
    }

    // if the question repeats (not the answer repeats)
    if (item._questionRepeatable) {
      // if it has multiple answers
      if (item._parentItem && Array.isArray(item._parentItem.items)) { // not sure this check is needed
        repetitions = this._getRepeatingItems(item);
        var numReps = repetitions.length;
        var newRowsNeeded = vals.length - numReps;
        repetitionCountChanged = (newRowsNeeded !== 0);
        var maxRecId, insertPosition;
        if (newRowsNeeded < 0) {
          // Remove extra rows.
          insertPosition = this._findIndexForNewRepetition(item) + newRowsNeeded;
          item._parentItem.items.splice(insertPosition, -newRowsNeeded);
          repetitions.splice(newRowsNeeded);
          if (vals.length === 0) {
            // In this case we have removed the last row.  Add it back.
            // We could just clear the  field, but it might have child items
            // which would also need to be clear.
            newRowsNeeded = 1;
            maxRecId = 0;
          }
        }
        if (newRowsNeeded > 0) {
          // Add new rows
          if (insertPosition === undefined) {
            insertPosition = this._findIndexForNewRepetition(item);
            maxRecId = this.getRepeatingItemMaxId(item);
          }
          var parentItemHidden = this._isHidden(item._parentItem);
          for (var i=0; i<newRowsNeeded; ++i) {
            var newItem = CommonUtils.deepCopy(this._repeatableItems[item.linkId]);
            newItem._id = maxRecId + 1;
            item._parentItem.items.splice(insertPosition, 0, newItem);
            newItem._parentItem = item._parentItem;
            repetitions.push(newItem);
            // preset the skip logic status to target-disabled on the new items
            this._presetSkipLogicStatus(newItem, parentItemHidden);
          }
        }
        // Set values now that the right number of rows are present
        for (var i=0, len=vals.length; i<len; ++i) {
          valueChanged = InternalUtil.assignValueToItem(repetitions[i], vals[i]) || valueChanged;
          if (messagesChanged)
            InternalUtil.setItemMessages(repetitions[i], messages[i], messageSource);
        }
      }
    }
    // question does not repeat (might have repeating answers)
    else {
      if (!item._multipleAnswers) { // no repeating answers
        valueChanged = InternalUtil.assignValueToItem(item, vals[0]) || valueChanged;
        if (vals.length > 1) {
          InternalUtil.addItemWarning(item, 'MultipleValuesForNonRepeat');
          console.log(JSON.stringify(vals));
        }
        else
          InternalUtil.removeItemWarning(item, 'MultipleValuesForNonRepeat');
      }
      else // repeating answers (e.g., a multi-selection list)
        item.value = vals;
      if (messagesChanged)
        InternalUtil.setItemMessagesArray(item, messages, messageSource);
    }

    if (repetitionCountChanged)
      this._resetInternalData();
    var readerMsg = 'Set values for ' + this.itemDescription(item);
    this._actionLogs.push(readerMsg);

    if (valueChanged) {
      // run form controls
      this.updateOnSourceItemChange(item);
    }
    // Return the new last repetition
    return repetitionCountChanged ? repetitions[repetitions.length - 1] : undefined;
  }


  /**
   *  Sets the messages for a group of repeating items.  The assumption is that
   *  the caller knows that the neither the values or nor the number items has
   *  changed, or else setRepeatingItems should have been called instead.
   * @param item an item (possibly repeating) to which values are to be
   *  assigned.
   * @param messages an Object whose key is a message source identifier and
   *  whose value is an array of message objects for each value.  See
   *  _convertFHIRValues for the format.
   * @param messageSource a string indentifier for the source of these messages,
   *  to distinguish them from messages from other sources.
   */
  setRepeatingItemMessages(item, messages, messageSource) {
    if (!CommonUtils.deepEqual(item._lastComputedMessages, messages)) {
      item._lastComputedRepeatingMessages = messages;
      if (item._questionRepeatable) {
        // if it has multiple answers
        if (item._parentItem && Array.isArray(item._parentItem.items)) { // not sure this check is needed
          const repetitions = this._getRepeatingItems(item);
          for (var i=0, len=repetitions.length; i<len; ++i) {
            InternalUtil.setItemMessages(repetitions[i], messages[i], messageSource);
          }
        }
      }
      // question does not repeat
      else {
        InternalUtil.setItemMessagesArray(item, messages, messageSource);
      }
    }
  }


  /**
   *  Returns the description of an item (section/question/row).
   * @param item the item whose type is needed
   */
  itemDescription(item) {
    return item._inHorizontalTable ?  'row' : item.dataType===CONSTANTS.DATA_TYPE.SECTION ? 'section' : 'question';
  }


  /**
   * Get the scores from source items
   * @param item the target item where the score rule is defined
   * @param formula the score rule formula
   * @returns {Array}
   * @private
   */
  _getScores(item, formula) {
    var scores = [];
    var sourceItems = this._getFormulaSourceItems(item, formula.value);

    for (var i= 0, iLen= sourceItems.length; i<iLen; i++) {
      var item = sourceItems[i];
      var score = 0;
      if (item && item.value && item.value.score &&
          item._skipLogicStatus !== CONSTANTS.SKIP_LOGIC.STATUS_DISABLED) {
        score = item.value.score
      }
      scores.push(score);
    }
    return scores;
  }


  /**
   * Get a source item from the question code defined in a score rule
   * @param item the target item where a formula is defined
   * @param linkIds the linkIds of source items
   * @returns {Array}
   * @private
   */
  _getFormulaSourceItems(item, linkIds) {
    var sourceItems = [];
    for (var i= 0, iLen=linkIds.length; i<iLen; i++) {
      var linkId = linkIds[i];

      var sourceItem = this._findItemByLinkId(item, linkId);
      sourceItems.push(sourceItem);
    }
    return sourceItems;
  }


  /**
   * Convert an item's value in its selected unit to the value in standard unit used for calculation
   * @param item an item
   * @param formula the formula defined on the item
   * @returns {Array}
   * @private
   */
  _getValuesInStandardUnit (item, formula) {
    var values = [];
    var sourceItems = this._getFormulaSourceItems(item, formula.value);

    for (var i= 0, iLen= sourceItems.length; i<iLen; i++) {
      var valueInStandardUnit = null;
      var item = sourceItems[i];
      if (item.value && item._skipLogicStatus !== CONSTANTS.SKIP_LOGIC.STATUS_DISABLED) {
        if (item.unit && item.unit.name) {
          valueInStandardUnit = Units.getValueInStandardUnit(parseFloat(item.value), item.unit.name);
        }
        else {
          valueInStandardUnit = parseFloat(item.value);
        }
      }
      values.push(valueInStandardUnit);
    }
    return values;
  }


  /**
   * Run the formula on the item and get the result
   * @param item an item
   * @returns {string}
   */
  getFormulaResult(item) {
    var result ='';
    var parameterValues = [];
    if (item.calculationMethod) {
      var formula = item.calculationMethod;
      // run score rule (there should be one score rule only in a form)
      if (formula.name === CONSTANTS.CALCULATION_METHOD.TOTALSCORE) {
        parameterValues = this._getScores(item, formula);
      }
      // run non-score rules
      else {
        // find the sources and target
        parameterValues = this._getValuesInStandardUnit(item,formula);
      }
      // calculate the formula result
      result = Formulas.calculations_[formula.name](parameterValues)
    }
    return result;
  }


  /**
   * Update data by running the formula on the target item
   * @param item the target item where there is a formula
   * @return {boolean} whether the item.value has changed
   */
  _processItemFormula(item) {
    var changed = false;
    if (item.calculationMethod && item.calculationMethod.name) {
      let newValue = this.getFormulaResult(item);
      if (!CommonUtils.deepEqual(newValue, item.value)) {
        item.value = newValue;
        changed = true;
      }
    }
    return changed;
  }


  /**
   * Update data by running the data control on the target item
   * @param item the target item where there is a data control
   * @return {boolean} whether the item.value has changed
   */
  _processItemDataControl(item) {
    var changed = false;
    if (item.dataControl && Array.isArray(item.dataControl)) {
      changed = this._updateDataByDataControl(item);
      // Force a reset of answers
      if (changed) {
        this._updateAutocompOptions(item);
        this._updateUnitAutocompOptions(item);
      }
    }
    return changed;
  }


  /**
   * Create a data object based on the value in dataFormat
   * @param dataFormat a string specifies how and where to get the data
   * @param sourceItem the source item, which is the data source
   * @returns {{}}
   * @private
   */
  _constructObjectByDataFormat(dataFormat, sourceItem) {
    var targetData = {};
    if (typeof dataFormat === 'object') {
      var keys = Object.keys(dataFormat);
      for (var i= 0, iLen=keys.length; i<iLen; i++) {
        targetData[keys[i]] = this._getDataFromNestedAttributes(dataFormat[keys[i]], sourceItem);
      }
    }
    return targetData;
  }


  /**
   * Create a data array based on the value in dataFormat
   * @param dataFormat a string specifies how and where to get the data
   * @param sourceItem the source item, which is the data source
   * @returns {Array}
   * @private
   */
  _constructArrayByDataFormat(dataFormat, sourceItem) {

    var targetData = [], abort = false;
    if (typeof dataFormat === 'object') {
      var keys = Object.keys(dataFormat);
      var listByKeys = {}, iLen=keys.length;
      var listLength = -1;
      for (var i= 0; i<iLen; i++) {
        var list = listByKeys[keys[i]] = this._getDataFromNestedAttributes(dataFormat[keys[i]], sourceItem);
        // abort if any data returned is not an array
        if (!Array.isArray(list)) {
          abort = true;
          break;
        }
        else if (listLength === -1) {
          listLength = list.length;
        }
        // abort if any returned array has a different length
        else if (listLength !== list.length) {
          abort = true;
          break;
        }
      }

      if(!abort) {
        for (var j=0; j<listLength; j++) {
          var elementData = {};
          for (var i= 0; i<iLen; i++) {
            elementData[keys[i]] = listByKeys[keys[i]][j];
          }
          targetData.push(elementData);
        }
      }
    }
    return targetData;
  }


  /**
   * Update the data on the item by running through the data control functions defined on this item.
   * @param item an item in the form
   * @return whether any data has changed on the item
   * @private
   */
  _updateDataByDataControl(item) {
    var changed = false;
    for (var i= 0, iLen=item.dataControl.length; i<iLen; i++) {
      var source = item.dataControl[i].source,
          onAttribute = item.dataControl[i].onAttribute,
          constructionType = item.dataControl[i].construction,
          dataFormat = item.dataControl[i].dataFormat;

      // the default target attribute where the data is set is "value"
      if (!onAttribute)
        onAttribute = "value";
      // the default construction type is "SIMPLE"
      if (!constructionType)
        constructionType = CONSTANTS.DATA_CONTROL.CONSTRUCTION_SIMPLE;
      // the default source data field is "value"
      if (!dataFormat)
        dataFormat = "value";

      // has a source configuration
      if (source) {
        var sourceType = source.sourceType;
        // the default source type is "INTERNAL", which uses "sourceLinkId" to locate the source item
        if (!sourceType)
          sourceType = CONSTANTS.DATA_CONTROL.SOURCE_INTERNAL;
        // "INTERNAL"
        if (sourceType === CONSTANTS.DATA_CONTROL.SOURCE_INTERNAL &&
            source.sourceLinkId) {
          // get the source item object
          var sourceItem = this._findItemByLinkId(item, source.sourceLinkId);
          if (sourceItem && sourceItem._skipLogicStatus !== CONSTANTS.SKIP_LOGIC.STATUS_DISABLED) {
            let newData;
            // check how to create the new data on target
            if (constructionType === CONSTANTS.DATA_CONTROL.CONSTRUCTION_ARRAY ) {
              newData = this._constructArrayByDataFormat(dataFormat, sourceItem);
            }
            else if (constructionType === CONSTANTS.DATA_CONTROL.CONSTRUCTION_OBJECT ) {
              newData = this._constructObjectByDataFormat(dataFormat, sourceItem);
            }
            else if (constructionType === CONSTANTS.DATA_CONTROL.CONSTRUCTION_SIMPLE) {
              // direct access to the data in source item
              newData = this._getDataFromNestedAttributes(dataFormat, sourceItem);
            }
            // set the data if it is different than the existing value
            if (!CommonUtils.deepEqual(item[onAttribute], newData)) {
              item[onAttribute] = CommonUtils.deepCopy(newData);
              changed = true;
            }
          }
        }
        // "EXTERNAL" uses "url" and optional "urlOptions" (an array), TBD
      } // end if source
    } // end of the loop of the data control

    return changed;
  }


  /**
   * Get data from a source item object following the nested attribute path
   * Examples:
   * sourceItem: {value: [ {attr1: 'v1', attr2: 'v2'}, {attr1: 'va', attr2: 'vb'}] }
   * strQuery:   value[1].attr1 ===> 'va'
   * sourceItem: [{value: [ {attr1: 'v1', attr2: 'v2'}, {attr1: 'va', attr2: 'vb'}] }, {}]
   * strQuery:   [0].value[0].attr1 ===> 'v1'
   * @param strQuery a query path, such as "attr[index].subattr.subsubattr"
   *        where attr is an array, subattr and subsubattr are objects.
   * @param sourceItem a source item object.
   *        Note: While "." is allowed in the attribute names of javascript object,
   *        here we assume "." is not used in the names of the item's attributes.
   * @returns {*}
   * @private
   */
  _getDataFromNestedAttributes(strQuery, sourceItem) {

    var levels = strQuery.trim().split('.');
    var dataSource = sourceItem, iLen = levels.length;

    for (var i = 0; i<iLen; i++) {
      if (dataSource) {
        var query = levels[i];
        // query not empty
        if (query) {
          // if it points to an item in an array, such as answers[1]
          var elementInArray = query.match(/^(.+)\[(\d+)\]$/);
          if(elementInArray) {
            var dataSource = dataSource[elementInArray[1]];
            var index =  parseInt(elementInArray[2]);
            if (Number.isInteger(index)) {
              dataSource = dataSource[index];
            }
            // stop if the index found is not an integer
            else {
              break;
            }
          }
          // if it points to an attribute
          else {
            dataSource = dataSource[query];
          }
        }
        // stop if the query is empty
        else {
          break;
        }
      }
      // stop if data is not found in the middle
      else {
        break;
      }
    }
    // data is valid AND all the parts of the query path are checked
    return (i === iLen && dataSource) ? dataSource : null;
  }


  /**
   * Set up autocomplete options for each item
   * @param items a list items of the form or in the templateOptions.
   */
  _setUpAnswerAndUnitAutoComp(items) {
    for (var i=0, iLen=items.length; i<iLen; i++) {
      var item = items[i];
      if (item._hasAnswerList) {
        this._updateAutocompOptions(item);
      }
      this._updateUnitAutocompOptions(item);
    }
  }


  /**
   *  Sets the display string for an item's unit.
   * @param unit the unit object on which the display string should be set.
   */
  _setUnitDisplay(unit) {
    unit._displayUnit = unit.name ? unit.name : unit.code ? unit.code : null;
  }


  /**
   * Update an item's units autocomplete options
   * @param item an item on the form
   * @private
   */
  _updateUnitAutocompOptions(item) {
    if (item.units && !item._hasAnswerList) {
      // add _displayUnit for item.unit if there is a value
      if (item.unit) {
        this._setUnitDisplay(item.unit);
      }

      // clean up unit autocomp options
      item._unitAutocompOptions = null;

      var listItems = [], answers = item.units;
      // Modify the label for each unit.
      var defaultUnit;
      for (var i= 0, iLen = answers.length; i<iLen; i++) {
        var listItem = CommonUtils.deepCopy(answers[i]);
        this._setUnitDisplay(listItem);
        if (answers[i].default) {
          defaultUnit = listItem;
        }
        // Include only if name or code is specified.
        if(listItem._displayUnit) {
          listItems.push(listItem);
        }
      }

      if (item.dataType === CONSTANTS.DATA_TYPE.INT ||
          item.dataType === CONSTANTS.DATA_TYPE.REAL) {
        // Per FHIR, if the item is of type integer or decimal, it can only have
        // one unit, and that unit is not editable.
        // However, this breaks our existing LOINC form definitions, so just
        // output a warning and convert the type..
        if (item.units && item.units.length > 1) {
          console.log('Form definition warning: Data types of INT or REAL may '+
            'only have one unit.  Question "'+ item.question+
            '" has '+item.units.length+' units.  For multiple '+
            'units, use type QTY instead.');
          item.dataType = CONSTANTS.DATA_TYPE.QTY;
        }
        else { // we didn't change dateType to QTY
          item._unitReadonly = true;
          if (!item.unit)
            item.unit = listItems[0];
        }
      }

      if (item.dataType === CONSTANTS.DATA_TYPE.QTY) {
        var options:any = {
          listItems: listItems,
          // matchListValue:
          //   true if there is a unit list and (no unitOpen extension, or optionsOnly, or optionsOrType)
          //     - Notes: 1) unitOption's comments imply CNE when there is a unit list
          //        2) optionsOrType:  Does not accept free-text, and we are not
          //           yet providing user entry of a coded value
          //   true if there is not a units list and (unitOpen = optionsOnly)
          matchListValue: item.units && (!item._unitOpen || item._unitOpen != 'optionsOrString') ||
            !item.units && item._unitOpen == 'optionsOnly',
          autoFill: true,
          display: "_displayUnit"
        };
        if (defaultUnit !== undefined) {
          options.defaultValue = defaultUnit;
        }
        else if (listItems.length === 1) {
          options.defaultValue = listItems[0];
        }
        if(!CommonUtils.deepEqual(item._unitAutocompOptions, options)) {
          item._unitAutocompOptions = options;
        }
      }
    }
  }


  /**
   * Reset item.value to an answer object (or multiple answers) in item.answers, or
   * to an object where _notOnList is set to true.
   * In the cases that answers is not loaded yet, keep the item.value as is.
   * @param item the item for which it has an item.value or item.defaultAnswers
   * @private
   */
  _resetItemValueWithAnswers(item) {

    // default answer and item.value could be a string value, if it is a not-on-list value for CWE types
    // convert it to the internal format of {text: 'string value', _notOnList: true}
    var modifiedValue = null;
    // item.value has the priority over item.defaultAnswer
    // if this is a saved form with user data, default answers are not to be used.
    // (item.value could be a coding that is no on the answer list, in R5)
    var answerValue = this.hasSavedData ? item.value : item.value || item.defaultAnswer;
    if (answerValue) {
      modifiedValue = [];
      // could be an array of multiple default values or a single value
      var answerValueArray = (item._multipleAnswers && Array.isArray(answerValue)) ?
          answerValue : [answerValue];
      if (item.dataType !== CONSTANTS.DATA_TYPE.CWE) {
        modifiedValue = answerValueArray;
      }
      else {
        // go through each value, there could be multiple not-on-list values
        for (var i=0, iLen=answerValueArray.length; i < iLen; ++i) {
          // string value is allowed if it is CWE
          if (typeof answerValueArray[i] === "string" || typeof answerValueArray[i] === "number") {
            modifiedValue.push({
              "text": answerValueArray[i],
              "_notOnList" : true});
            // for radio button/checkbox display, where only one "Other" option is displayed
            item._answerOther = answerValueArray[i];
            item._answerOtherChecked = true;
          }
          else {
            modifiedValue.push(answerValueArray[i]);
          }
        }
      }
    }

    if (modifiedValue) {
      var listVals = [];
      // CNE/CWE
      if (item.dataType === CONSTANTS.DATA_TYPE.CNE || item.dataType === CONSTANTS.DATA_TYPE.CWE) {
        for (var k=0, kLen=modifiedValue.length; k<kLen; ++k) {
          var userValue = modifiedValue[k];
          var found = false;
          // for search field, assume the user values are valid answers
          if (item.externallyDefined) {
            listVals = modifiedValue;
          }
          // for item has a answer list
          else {
            // item.answers has a list or the answers have been loaded.
            if (Array.isArray(item.answers)) {
              for (var j=0, jLen=item.answers.length; !found && j<jLen; ++j) {
                if (CommonUtils.areTwoAnswersSame(userValue, item.answers[j], item)) {
                  listVals.push(item.answers[j]);
                  found = true;
                }
              }
              // value is not on the answer list and it is a CWE (so that user saved values that are not on the list will be kept)
              if (!found && item.dataType === CONSTANTS.DATA_TYPE.CWE) {
                userValue._notOnList = true;  // _notOnList might have been set above when the orginal value is a string
                listVals.push(userValue);
              }
            }
            // item.answers have not been loaded yet (by loadFHIRResources or by FHIR PATH expressions.)
            else {
              listVals.push(userValue);
            }
          }
        }
      }
      // INT, ST, DT and TM
      else {
        listVals = modifiedValue;
      }
      
      let newValue = item._multipleAnswers ? listVals : listVals[0];
      // reset item.value even if item.value and newValue are same (radiobuttons in matrix layout needs this reset)
      item.value = newValue;
    }
  }


  /**
   *  Uses the FHIR client to search the given ValueSet for the string
   *  fieldVal.
   * @param valueSetID the ID of the ValueSet to search (expand)
   * @param fieldVal the value on which to filter the ValueSet
   * @param count the maximum count to return
   * @return a Promise that will resolve to the ValueSet expansion.
   */
  _fhirClientSearchByValueSetID(valueSetID, fieldVal, count) {
    var fhirClient = LForms.fhirContext.client;
    return fhirClient.request(this._buildURL(['ValueSet',valueSetID,'$expand'],
      {count: count, filter: fieldVal}
    ));
  }


  /**
   *  This is an alternative search mechanism to work around a problem with
   *  HAPI FHIR, which does not support $expand with both url and filter.
   * @param item an item on the form
   * @param fieldVal the value on which to filter the ValueSet
   * @param count the maximum count to return
   * @return a Promise that will resolve to the ValueSet expansion.
   */
  _findValueSetIDAndSearch(item, fieldVal, count) {
    // Fetch the ValueSet
    // Fetch the ValueSet
    var failMsg = "Could not retrieve the ValueSet definition for "+
          item.answerValueSet;
    var fhirClient = LForms.fhirContext.client;
    // Cache the lookup of ValueSet IDs, which should not change.  (A page
    // reload will clear the cache.)
    if (!LForms._valueSetUrlToID)
      LForms._valueSetUrlToID = {}
    var valueSetID =  LForms._valueSetUrlToID[item.answerValueSet];
    if (valueSetID) {
      return this._fhirClientSearchByValueSetID(valueSetID, fieldVal, count);
    }
    else {
      const self = this;
      return fhirClient.request(this._buildURL(['ValueSet'],
          {url: item.answerValueSet, _total: 'accurate'})
      ).then(function(response) {
        var data = response;
        if (data.total === 1) {
          var valueSetID = data.entry[0].resource.id;
          LForms._valueSetUrlToID[item.answerValueSet] = valueSetID;
          return self._fhirClientSearchByValueSetID(valueSetID, fieldVal, count);
        }
        else {
          console.log(failMsg);
          return Promise.reject(failMsg);
        }
      },
      function(errorData) {
        console.log(failMsg);
        return Promise.reject(failMsg);
      });
    }
  }


  /**
   * Update an item's autocomplete options
   * It handles 3 cases in order of priority: 1) item.externallyDefined, 2) item.answerValueSet,
   * and 3) item.answers
   * @param item an item on the form
   * @private
   */
  _updateAutocompOptions(item) {
    // for list only
    if (item._hasAnswerList) {

      var maxSelect = item.answerCardinality ? item.answerCardinality.max : 1;
      if (maxSelect !== '*' && typeof maxSelect === 'string') {
        maxSelect = parseInt(maxSelect);
      }

      var options:any = {
        matchListValue: item.dataType !== CONSTANTS.DATA_TYPE.CWE, // INT, ST, DT, TM and CNE should all match
        maxSelect: maxSelect,
        autoFill: false
      };

      // externallyDefined
      var url = item.externallyDefined; // item.dataType should be CNE or CWE
      if (url) {
        options.url = url;
        options.autocomp = true;
        options.nonMatchSuggestions = false;
        options.tableFormat = true;
        options.valueCols = [0];
        options.colHeaders = item.displayControl.listColHeaders;
        if (options.colHeaders) {
          var h = options.colHeaders;
          // Escape HTML tags to prevent them from rendering
          for (var i=0, len=h.length; i<len; ++i)
            h[i] = h[i].replace(/</g, '&lt;');
        }
      }
      // isSearchAutocomplete && answerValueSet
      else if (item.isSearchAutocomplete && item.answerValueSet) {
        var valueSetUri = item.answerValueSet;
        // See if there is a terminology server for expanding this valueset
        var expURL = this._getFHIRSupport().SDC._getExpansionURL(item);
        if (expURL) {  // undefined unless there is a terminology server
          // TBD - We might need to log in to some terminology servers.  Not
          // supporting that case yet.
          // Skip the fhirContext, and go directly to the terminology server
          // for the autocompletion requests.
          options.url = expURL;
          options.fhir = true;
        }
        else if (LForms.fhirContext?.client) {
          const self = this;
          options.fhir = {search: function(fieldVal, count) {
            if (LForms.fhirCapabilities.urlExpandBroken)
              return self._findValueSetIDAndSearch(item, fieldVal, count);
            else {
              var fhirClient =  LForms.fhirContext.client;
              return fhirClient.request(self._buildURL(['ValueSet', '$expand'],
                {count: count, filter: fieldVal, url: item.answerValueSet}
              )).catch((errorData) => {
                LForms.fhirCapabilities.urlExpandBroken = true;
                // HAPI does not support (maybe just because of a bug) $expand
                // when both "url" and "filter" parameters are present.  In that
                // case, it says, ""ValueSet contains include criteria with no
                // system defined".
                //if (errorData.data.responseJSON.issue[0].diagnostics ==
                //  'ValueSet contains include criteria with no system defined') {
                // For now, just always try the alternative.
                return self._findValueSetIDAndSearch(item, fieldVal, count);
              });
            }
          }};
        }
        else {
          throw new Error('Cannot properly initialize the list for field "'+
            item.question+'" because it requires either a terminology '+
            'server to be specified or LForms.Util.setFHIRContext(...) '+
            'to have been called to provide access to a FHIR server.');
        }
      }
      // answers
      else {
        [options.listItems, options.addSeqNum] =
          this._getAnswerDisplayTextWithLabelAndScore(this.templateOptions.displayScoreWithAnswerText, item); 
        options.display = '_displayText';
        // use the original answers as the models (used in the autocomplete component)
        options.listItemsForModel = item.answers;

        // See if there are list headings, and set them up if so.
        // The only way to determine this is to check whether parentAnswerCode
        // is defined on any item.
        // It would be more efficient to have a flag defined on the question
        // level.
        var answers = options.listItems;
        var noHeadings = true;
        for (i=0, len=answers.length; i<len && noHeadings; ++i)
          noHeadings = !!answers[i].parentAnswerCode;
        if (!noHeadings) {
          var codes = [];
          var itemToHeading = {}; // list item (answer) to heading
          for (var i=0, len=answers.length; i<len; ++i) {
            var ans = answers[i];
            codes.push(ans.code);
            if (ans.parentAnswerCode)
              itemToHeading[ans.code] = ans.parentAnswerCode;
          }
          options.codes = codes;
          options.itemToHeading = itemToHeading;
        }
      }
      // check if the new option has changed
      if (!CommonUtils.deepEqual(options, item._autocompOptions)) {
        item._autocompOptions = options;
      }
    } // end of list
  }


  /**
   * Changes the answer's display text when there is a label and/or a score
   * @param addScoreToText a flag indicating whether to add the score to the display text
   * if there is a score in answers.
   * @param item an item in the form
   * @returns answers with a modified display text on each answer item, and
   *          a flag whether to add sequence number for the each answer's displayed text.
   */
  _getAnswerDisplayTextWithLabelAndScore(addScoreToText, item) {
    // reset the modified answers (for the display text)
    var modifiedAnswers = [];
    var hasOneAnswerLabel = false;
    var hasOneNumericAnswer = false;
    let answers = item.answers;
    if (answers && Array.isArray(answers)) {
      for (var i = 0, iLen = answers.length; i < iLen; i++) {
        var answerData = CommonUtils.deepCopy(answers[i]);
  
        var displayText = answerData.text + ""; // convert integer to string when the answerOption is an integer
        // label is a string
        if (answerData.label) {
          displayText = answerData.label + ". " + displayText;
          hasOneAnswerLabel = true;
        }
        // check if one of the values is numeric
        else {
          if (!hasOneNumericAnswer && !isNaN(answerData.text)) {
            hasOneNumericAnswer = true;
          }
        }

        if (answerData.score !== undefined && answerData.score !== null) {
          item._hasScoreInAnswer = true;
          if (addScoreToText)
            displayText = displayText + " - " + answerData.score;
        }

        // always uses _displayText in autocomplete-lhc and radio buttons/checkboxes for display
        answerData._displayText = displayText;
        modifiedAnswers.push(answerData);
      }  
    }
    // add seq num when there is no labels and no numeric values as answer
    var acAddSeq = !hasOneAnswerLabel && !hasOneNumericAnswer;
    
    return [modifiedAnswers, acAddSeq];
  }


  /**
   * Check if a number is within a range.
   * keys in a range are "minInclusive"/"minExclusive" and/or "maxInclusive"/"maxExclusive"
   * range example: {"minInclusive": 3, "maxInclusive":10}
   * @param range data range
   * @param numValue an item's numeric value
   * @returns {boolean}
   * @private
   */
  _inRange(range, numValue) {
    var inRange = false;

    if (range && !isNaN(numValue)) {
      var fields = Object.keys(range);
      // one key
      if (fields.length == 1) {
        switch (fields[0]) {
          case "minInclusive":
            inRange = range["minInclusive"] <= numValue;
            break;
          case "minExclusive":
            inRange = range["minExclusive"] < numValue;
            break;
          case "maxInclusive":
            inRange = range["maxInclusive"] >= numValue;
            break;
          case "maxExclusive":
            inRange = range["maxExclusive"] > numValue;
            break;
        } // end of switch
      } // end of one key
      // two keys
      else if (fields.length == 2) {
        // check the lower end
        if (range.hasOwnProperty("minInclusive")) {
          inRange = range["minInclusive"] <= numValue;
        }
        else if (range.hasOwnProperty("minExclusive")) {
          inRange = range["minExclusive"] < numValue;
        }
        // check the upper end
        if (inRange) {
          if (range.hasOwnProperty("maxInclusive")) {
            inRange = range["maxInclusive"] >= numValue;
          }
          else if (range.hasOwnProperty("maxExclusive")) {
            inRange = range["maxExclusive"] > numValue;
          }
        } // end if lower end valid
      } // end of two keys
    } // end of valid range and numValue

    return inRange;
  }


  /**
   * Shallowly compares two JavaScript objects to see if their keys and values are equal.
   * @param obj1
   * @param obj2
   * @returns {boolean}
   * @private
   */
  _objectEqual(obj1, obj2) {
    return CommonUtils.shallowEqual(obj1, obj2);
  }


  /**
   * Find an item by linkId. It follows the algorithm described here:
   * https://www.hl7.org/fhir/questionnaire-definitions.html#Questionnaire.item.enableWhen.question
   * If multiple question occurrences are present for the same question (same linkId),
   * then this refers to the nearest question occurrence reachable by tracing first
   * the "ancestor" axis and then the "preceding" axis and then the "following" axis.
   * @param item an item where the search starts
   * @param linkId a linkId
   * @returns {null}
   * @private
   */
  _findItemByLinkId(item, linkId) {
    var sourceItem = null;

    // check 'ancestor' axis
    var parentItem = item._parentItem;
    var foundSource = false;
    while (!foundSource && parentItem) {
      // check the ancestor
      if (parentItem.linkId === linkId) {
        sourceItem = parentItem;
        foundSource = true;
      }
      parentItem = parentItem._parentItem;
    }

    var itemIndex = null;
    if (!sourceItem) {
      // find the item's position in itemList
      for (var i=0, iLen=this.itemList.length; i<iLen; i++) {
        if(item._elementId === this.itemList[i]._elementId) {
          itemIndex = i;
          break;
        }
      }
      if (itemIndex !== null) {
        // check 'preceding' axis
        for (var j=itemIndex-1; j>=0; j--) {
          if (this.itemList[j].linkId === linkId) {
            sourceItem = this.itemList[j];
            break;
          }
        }
        // check 'following' axis
        if (!sourceItem) {
          for (var k=itemIndex+1, kLen = this.itemList.length; k<kLen; k++) {
            if (this.itemList[k].linkId === linkId) {
              sourceItem = this.itemList[k];
              break;
            }
          }
        }
      }
    }

    return sourceItem;
  }


  /**
   * Get a source item from the question code defined in a skip logic
   * @param item the target item where a skip logic is defined
   * @param linkId the linkId of a source item
   * @returns {Array}
   * @private
   */
  _getSkipLogicSourceItem(item, linkId) {
    return this._findItemByLinkId(item, linkId);
  }


  /**
   * Compare if the two given codings are equal. A "coding" is a hash that may have any or all of the
   * following three fields: code, system, and text. Two codings are considered equal if and only if:
   * 1) The code systems are equal or unspecified, and
   * 2) Either the codes are specified and equal, or, the codes are not specified and the texts are
   *    specified and equal.
   * @param coding1 the first coding object
   * @param coding2 the second coding object
   * @return {boolean} true if the two codings are considered equal, false otherwise.
   * @private
   */
  _codingsEqual(coding1, coding2) {
    let equals = false;
    let hasValue = (v) => v !== null && v !== undefined && v !== '';
    if(coding1.system === coding2.system || !coding1.system && !coding2.system) {
      if(hasValue(coding1.code) || hasValue(coding2.code)) {
        equals = coding1.code === coding2.code;
      }
      else {
        equals = coding1.text && coding2.text && coding1.text === coding2.text;
      }
    }

    return !!equals;
  }


  /**
   * Check if a source item's value meet a skip logic condition/trigger
   * @param item a source item of a skip logic
   * @param trigger a trigger of a skip logic
   * @returns {boolean}
   * @private
   */
  _checkSkipLogicCondition(item, trigger) {
    var action = false;
    var hasAnswer = item && item.value !== undefined && item.value !== null && item.value !== ""
                    && item._skipLogicStatus !== CONSTANTS.SKIP_LOGIC.STATUS_DISABLED;

    // the trigger contains only one of keys of 'exists', 'not', 'value' or minExclusive, minInclusive,
    // maxExclusive or maxInclusive.
    // 'not' means '!=', 'value' means '='.
    if(trigger.hasOwnProperty('exists')) {
      action = trigger.exists && hasAnswer || !trigger.exists && !hasAnswer;
    }
    else if (hasAnswer) {
      var currentValue = item.value;

      // if the item has an answer list (of coding, string, integer, date or time)
      if (item._hasAnswerList) {
        switch (item.dataType) {
          // answer lists: {"code", "LA-83"}, {"label","A"} and etc.
          // the key is one of the keys in the answers.
          case CONSTANTS.DATA_TYPE.CNE:
          case CONSTANTS.DATA_TYPE.CWE:
          case CONSTANTS.DATA_TYPE.INT:
          case CONSTANTS.DATA_TYPE.ST:
          case CONSTANTS.DATA_TYPE.DT:
          case CONSTANTS.DATA_TYPE.TM:
            var triggerValue = trigger.hasOwnProperty('value') ? trigger.value : trigger.hasOwnProperty('notEqual') ? trigger.notEqual : null;
            var answerValues = Array.isArray(currentValue)? currentValue: [currentValue];
            var isEqual = false;
            for (var m= 0, mLen = answerValues.length; m<mLen; m++) {
              let answerValue = answerValues[m];
              if (item.dataType === CONSTANTS.DATA_TYPE.CNE || item.dataType === CONSTANTS.DATA_TYPE.CWE) {
                if(item.answerCodeSystem) {
                  answerValue = Object.assign({system: item.answerCodeSystem}, answerValue);
                }
                if(this._codingsEqual(triggerValue, answerValue)) {
                  isEqual = true;
                  break;
                }
              }
              // ST, INT, DT, TM
              else {
                if(triggerValue === answerValue.text) {
                  isEqual = true;
                  break;
                }
              }
            }
            if (trigger.hasOwnProperty('value')) {
              if (isEqual) {
                action = true;
              }
            }
            else if (trigger.hasOwnProperty('notEqual')) {
              if (!isEqual) {
                action = true;
              }
            }
            break;
        } // end case
      }
      // no answer list
      else {
        switch (item.dataType) {
          // numbers: {"value: 3}, {"minInclusive": 3, "maxInclusive":10} and etc.
          // available keys: (1) "value", (2) "not" or (3) "minInclusive"/"minExclusive" and/or "maxInclusive"/"maxExclusive"
          case CONSTANTS.DATA_TYPE.INT:
          case CONSTANTS.DATA_TYPE.REAL:
          case CONSTANTS.DATA_TYPE.QTY:
            var numCurrentValue = parseFloat(currentValue);
            // the skip logic rule has a "value" key
            if (trigger.hasOwnProperty("value")) {
              if (trigger["value"] === numCurrentValue) {
                action = true;
              }
            }
            else if (trigger.hasOwnProperty('notEqual')) {
              if (trigger["notEqual"] != numCurrentValue) {
                action = true;
              }
            }
            // the skip logic rule has a range
            else {
              // if within the range
              if (this._inRange(trigger, numCurrentValue)) {
                action = true;
              }
            }
            break;
          // string: {"value": "AAA"}   ( TBD: {"pattern": "/^Loinc/"} )
          // the only key is "value", for now
          case CONSTANTS.DATA_TYPE.ST:
          case CONSTANTS.DATA_TYPE.TX:
          // boolean: {"value": true}, {"value": false}
          // the only key is "value"
          case CONSTANTS.DATA_TYPE.BL:
            if (trigger.hasOwnProperty("value")) {
              if (trigger["value"] === currentValue ) {
                action = true;
              }
            }
            else if (trigger.hasOwnProperty('notEqual')) {
              if (trigger["notEqual"] != currentValue) {
                action = true;
              }
            }
            break;
        } // end case
      }     
    }
    // no answer and 'notEqual' has a value
    else if (trigger.hasOwnProperty('notEqual') &&
        trigger.notEqual !==undefined && trigger.notEqual !== null && trigger.notEqual !== "") {
      action = true;
    }

    return action;
  }


  /**
   * Check if all the conditions/triggers are met for a skip logic
   * @param item a target item where a skip logic is defined
   * @returns {boolean}
   * @private
   */
  _checkSkipLogic(item) {
    var takeAction = false;
    if (item.skipLogic) {
      var hasAll = item.skipLogic.logic === "ALL";
      var hasAny = !item.skipLogic.logic || item.skipLogic.logic === "ANY"; // per spec, default is ANY
      // set initial value takeAction to true if the 'logic' is not set or its value is 'ALL'
      // otherwise its value is false, including when the 'logic' value is 'ANY'
      takeAction = hasAll;

      for (var i= 0, iLen=item.skipLogic.conditions.length; i<iLen; i++) {
        var condition = item.skipLogic.conditions[i];
        var sourceItem = this._getSkipLogicSourceItem(item, condition.source);
        var conditionMet = this._checkSkipLogicCondition(sourceItem, condition.trigger);
        // ALL: check all conditions until one is not met, or all are met.
        if (hasAll && !conditionMet ) {
          takeAction = false;
          break;
        }
        // ANY: check all conditions until one is met, or none is met.
        else if (hasAny && conditionMet) {
          takeAction = true;
          break;
        }
      } // end of conditions loop
    } // end of skipLogic

    return takeAction;
  }


  /**
   * Get the css class on the skip logic target field
   * @param item
   * @returns {string|string|*|string}
   */
  getSkipLogicClass(item) {
      return item._skipLogicStatus;
  }


  /**
   * Check if the question needs an extra input
   * @param item an item in the lforms form items array
   * @returns {boolean}
   */
  needExtra(item) {
    var extra = false;
    if (item && item.value) {
      // NOT to support multiple values of 'other' when multiple answers are allowed.
      // if (Array.isArray(item.value)) {
      //   jQuery.each(item.value, function(index, answer) {
      //     if (answer.other) {
      //       extra = true;
      //     }
      //   });
      // }
      if (!Array.isArray(item.value) && item.value.other) {
        extra = true;
      }
    }
    return extra;
  }


  /**
   * Set the active row in table
   * @param item an item
   */
  setActiveRow(item) {
    this._activeItem = item;
  }


  /**
   * Get the css class for the active row
   * @param item an item
   * @returns {string}
   */
  getActiveRowClass(item) {
    var ret = "";
    if (this._activeItem && this._activeItem._elementId === item._elementId) {
      ret = "lhc-active-row";
    }
    return ret;
  }


};
