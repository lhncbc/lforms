/**
 * A package to process user data validations in LForms
 */
import CommonUtils from "./lhc-common-utils.js";

const Validation = {
  // the period of time (in milliseconds)  for which a validation massage is displayed after the control loses focus
  _timeout: 1500,

  // supported keys in restrictions
  _restrictionKeys : [
    "minExclusive",
    "minInclusive",
    "maxExclusive",
    "maxInclusive",
    "totalDigits", // not used
    "fractionDigits", // not used
    "length",
    "minLength",
    "maxLength",
    "enumeration", // not used
    "whiteSpace", // not used
    "pattern"
  ],

  // supported data types
  _dataTypes : [
    "BL",      // not fully supported yet
    "INT",
    "REAL",
    "ST",
    "TX",      // long text
    "BIN",     // not supported yet
    "DT",      // complex type
    "DTM",     // complex type, not supported yet
    "TM",      // complex type
    "CNE",     // complex type
    "CWE",     // complex type
    "RTO",     // complex type, not supported yet
    "QTY",     // complex type
    "NR",      // complex type
    "YEAR",    // sub-type of "ST"
    "MONTH",   // sub-type of "ST"
    "DAY",     // sub-type of "ST"
    "URL",     // sub-type of "ST"
    "EMAIL",   // sub-type of "ST"
    "PHONE",   // sub-type of "ST"
    ""         // for header, no input field
  ],

  _errorMessages : {
    "BL": "muss ein boolean-Wert sein (true/false).",     // not fully supported
    "INT": "muss eine Ganzzahl sein.",
    "REAL": "muss eine Dezimalzahl sein.",
    "ST": "must be a string value.",      // not needed
    "TX": "must be a text value.",        // not needed
    "BIN": "must be a binary value.",     // not supported
    "DT": "must be a date value.",        // not used, handled by lf-date directive
    "DTM": "must be a date and time value.",  // not supported
    "TM": "muss eine Zeitangabe sein.",
    "CNE": "must be a value from the answer list.",  // not used, handled by the autocomplete-lhc directive
    "CWE": "must be a value from the answer list or a user supplied value.", // not used, handled by the autocomplete-lhc directive
    "RTO": "must be a ratio value.",          // not supported
    "QTY": "muss eine Dezimalzahl sein",
    "NR": "must be two numeric values separated by a ^. One value can be omitted, but not the ^.",
    "YEAR": "muss eine Jahresangabe sein.",
    "MONTH": "muss eine numerische Monatsangabe sein.",
    "DAY": "muss eine numerische Tagesangangabe sein.",
    "URL": "muss eine gültige URL sein.",
    "EMAIL": "muss eine gültige URL sein.",
    "PHONE": "muss eine gültige Telefonnummer sein."
  },

  /**
   * Returns false if the item requires a value but does not have one, and true otherwise
   * @param required a flag that indicates if the value is required
   * @param value the user input value
   * @param errors the error messages array that returns
   * @returns {boolean}
   */
  checkRequired: function(required, value, errors) {
    var ret = true;
    if (required &&
        (value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length ===0))) {
      ret = false;
      errors.push(" - Eingabe erforderlich");
    }
    return ret;
  },


  /**
   * Check if value is of the specified data type
   * @param dataType the specified data type
   * @param value the user input value
   * @param errors the error messages array that returns
   * @returns {boolean}
   */
  checkDataType: function(dataType, value, errors) {

    var valid = true;
    if (value !== undefined && value !== null && value !=="") {
      switch(dataType) {
        case "BL":
          if (value !== true && value !== false) {
            valid = false;
          }
          break;
        case "INT":
          valid = CommonUtils.isInteger(value);
          break;
        case "REAL":
        case "QTY":
          valid = CommonUtils.isDecimal(value);
          break;
        case "PHONE":
          var regex = /(((^\s*(\d\d){0,1}\s*(-?|\.)\s*(\(?\d\d\d\)?\s*(-?|\.?)){0,1}\s*\d\d\d\s*(-?|\.?)\s*\d{4}\b)|(^\s*\+\(?(\d{1,4}\)?(-?|\.?))(\s*\(?\d{2,}\)?\s*(-?|\.?)\s*\d{2,}\s*(-?|\.?)(\s*\d*\s*(-|\.?)){0,3})))(\s*(x|ext|X)\s*\d+){0,1}$)/;
          valid = regex.test(value);
          break;
        case "EMAIL":
          var regex = /^\s*((\w+)(\.\w+)*)@((\w+)(\.\w+)+)$/;
          valid = regex.test(value);
          break;
        case "URL":
          var regex = /^(https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?$/;
          valid = regex.test(value);
          break;
        case "TM":  // time
          var regex = /^\s*(((\d|[0-1]\d|2[0-4]):([0-5]\d))|(\d|0\d|1[0-2]):([0-5]\d)\s*([aApP][mM]))\s*$/;
          valid = regex.test(value);
          break;
        case "YEAR":
          var regex = /^\d{1,4}$/;
          valid = regex.test(value);
          break;
        case "MONTH":
          var regex =/^(0?[1-9]|1[012])$/;
          valid = regex.test(value);
          break;
        case "DAY":
          var regex = /^(0?[1-9]|[12]\d|3[01])$/;
          valid = regex.test(value);
          break;
        case "NR":
          var regex = /^(\-?\d+(\.\d*)?)?\s*\^\s*(\-?\d+(\.\d*)?)?$/;
          valid = regex.test(value);
          break;
        case "DT":  // date, handled by date directive
          valid = CommonUtils.isValidDate(value);
          break;
        case "ST":  // not needed
        case "DTM": // dataTime, handled by the datetime directive (datetime picker)
        case "RTO": // TBD
        case "CNE": // answers list with no exception, handled by autocomplete directive
        case "CWE": // answers list with exception, handled by autocomplete directive
        default :
          valid = true;
      }
    }

    if (Array.isArray(errors) && !valid) {
      errors.push(this._errorMessages[dataType]);
    }

    return valid;
  },

  /**
   * Check the value against a list of the restrictions
   * @param restrictions a hash of the restrictions and their values
   * @param value the user input value
   * @param errors the error messages array that returns
   * @returns {boolean}
   */
  checkRestrictions: function(restrictions, value, errors) {

    var allValid = true;
    if (value !== undefined && value !== null && value !=="") {
      for (var key in restrictions) {
        var valid = true;
        var keyValue = restrictions[key];
        switch(key) {
          case "minExclusive":
            if (parseFloat(value) > parseFloat(keyValue)) {
              valid = true;
            }
            else {
              valid = false;
              errors.push(" - Wert muss größer sein als " + keyValue + ".");
            }
            break;
          case "minInclusive":
            if (parseFloat(value) >= parseFloat(keyValue)) {
              valid = true;
            }
            else {
              valid = false;
              errors.push(" - Wert muss größer oder gleich sein als " + keyValue+ ".");
            }
            break;
          case "maxExclusive":
            if (parseFloat(value) < parseFloat(keyValue)) {
              valid = true;
            }
            else {
              valid = false;
              errors.push(" - Wert muss kleiner sein als " + keyValue+ ".");
            }
            break;
          case "maxInclusive":
            if (parseFloat(value) <= parseFloat(keyValue)) {
              valid = true;
            }
            else {
              valid = false;
              errors.push("- Wert muss kleiner oder gleich sein als " + keyValue+ ".");
            }
            break;
          case "totalDigits":
            // TBD
            break;
          case "fractionDigits":
            // TBD
            break;
          case "length":
            if (value.length == parseInt(keyValue)) {
              valid = true;
            }
            else {
              valid = false;
              errors.push(" - muss eine Länge haben von " + keyValue+ ".");
            }
            break;
          case "maxLength":
            if (value.length <= parseInt(keyValue)) {
              valid = true;
            }
            else {
              valid = false;
              errors.push(" - darf maximal " + keyValue + " Zeichen lang sein.");
            }
            break;
          case "minLength":
            if (value.length >= parseInt(keyValue)) {
              valid = true;
            }
            else {
              valid = false;
              errors.push(" - muss mindestens "  + keyValue + " Zeichen lang sein.");
            }
            break;
          case "pattern":
            // the "\" in the pattern string should have been escaped
            var indexOfFirst = keyValue.indexOf("/");
            var indexOfLast = keyValue.lastIndexOf("/");
            // get the pattern and the flag
            var pattern = keyValue.slice(indexOfFirst+1, indexOfLast);
            var flags = keyValue.slice(indexOfLast+1);
            var regex = new RegExp(pattern, flags);
            if (regex.test(value)) {
              valid = true;
            }
            else {
              valid = false;
              errors.push(" - muss folgendem Muster entsprechen: " + keyValue+ ".");
            }
            break;
          default:
            valid = true;
        }
        allValid = allValid && valid;
      }
    }

    return allValid;
  }
};

export default Validation;
