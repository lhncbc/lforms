/**
 * Common utility functions
 */
import moment from "moment"
import copy from "fast-copy";
import deepEqual from "deep-equal";

const CommonUtils = {

// Acceptable date formats

// Strict parsing -
  parseDateFormats : [
    'M/D/YYYY',
    'M/D/YY',
    'M/D',
    'M-D-YYYY',
    'M-D-YY',
    'M-D',
    'YYYY',
    'YYYY-M-D',
    'YYYY/M/D',
    'DD.MM.YYYY',
    moment.ISO_8601,
    'M/D/YYYY HH:mm',
    'M/D/YY HH:mm',
    'M/D HH:mm',
    'M-D-YYYY HH:mm',
    'M-D-YY HH:mm',
    'M-D HH:mm',
    'DD.MM.YYYY HH:mm'
  ],

  intRegex: /^\s*(\+|-)?\d+\s*$/,

  decRegex: /^\s*[\+-]?([\+-]?\d+\.?\d*([eE]?[\+|-]?\d+)?|[\+-]?\d*\.?\d+[eE]?([\+|-]?\d+)?)\s*$/,
  
  /**
   * Check if two answers can be treated as same
   * @param answer an answer item that could have part of the attributes set. 
   * It should be an object, or this function will return false.
   * @param completeAnswer an answer in the answer list that usually has more attributes set
   * @param item the lforms item that has the completeAnswer in the answer list
   * @return {boolean} whether two answers are considered same.
   */
  areTwoAnswersSame: function(answer, completeAnswer, item) {

    let standardAnswerAttr = ['label', 'code', 'text', 'score', 'other'];
    //let standardAnswerAttr = ['label', 'code', '_displayText', 'score', 'other'];

    if (typeof answer !== "object") {
      return false;
    }
    // answer in LForms might not have a codeSystem, check item.answerCodeSystem and form's codeSystem
    let completeAnswerCodeSystem = completeAnswer.system ? completeAnswer.system : item.answerCodeSystem;

    // check answers' attributes if they have the same code system
    let same = false;
    // if no code system or same code system
    if (!answer.system && !completeAnswer.system ||
        answer.system === completeAnswerCodeSystem) {
      // check all fields in answer
      same = true;
      let fields = Object.keys(answer);
      for (var i= 0, iLen=fields.length; i<iLen; i++) {
        // not to check extra attributes not specified in specs.
        if (standardAnswerAttr.indexOf(fields[i]) >= 0 && answer[fields[i]] !== completeAnswer[fields[i]]) {
          same = false;
          break;
        }
      }
    }
    return same;
  },


 /**
   * This function and stringToDTDateISO are meant to work as a pair on DT (or FHIR date) data type.
   * The idea is that DT/date type does not have timezone info, as a result, the string value could be
   * off by a day during either way of conversion depending on the time zone the code is executed.
   * The solution here is to keep the literal values of the year, month, and date components remain
   * unchanged regardless of the time zones.
   * Convert the given date object into a DT type date string, in "yyyy-mm-dd" format, where the
   * year, month, and date are based on the "local time zone" as the users can see on the display.
   * @param dateObj the date object to be converted.
   * @return date string in yyyy-mm-dd format with year, month, and date values corresponding to that
   * at the local timezone.
   */
  dateToDTStringISO: function(dateObj) {
    return (! dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime()))? undefined: [
      (10000 + dateObj.getFullYear()).toString().substr(1),
      (101 + dateObj.getMonth()).toString().substr(1),
      (100 + dateObj.getDate()).toString().substr(1) ].join('-');
  },


  /**
   * Parse the given iso date string, that is, a string of format "yyyy[-mm[-dd]]", into a Date object,
   * and then, adjust the year, month, and day so that when displayed (as local date) the literal values of
   * the year, month, and date components remain unchanged.
   * See the comments/docs for function dateToDTStringISO().
   * @param isoDateString
   */
  stringToDTDateISO: function(isoDateString) {
    var d = new Date(isoDateString);
    return isNaN(d.getTime())? undefined: new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  },

  /**
   * Get a formatted date string from a date object
   * for example: "2016-10-31T14:42:12Z"
   * @param objDate a date object, or a valid string representation of date.
   * @returns a formatted date string
   */
  dateToDTMString: function(objDate) {
    if(typeof objDate === 'string') {
      objDate = this.stringToDate(objDate, true);
    }
    return objDate.toISOString();
  },

  // TODO: move to lhc-form-utils.js
  /**
   * Parse a formatted date string and create a date object
   * @param strDate a formatted date string
   * @param looseParsing {boolean} - Do default parsing. Intended to parse output
   * from native date object, typically from programmatic output from widgets. Default is false.
   * @returns a date object
   */
  stringToDate: function(strDate, looseParsing) {
    if(! strDate || (typeof strDate) != 'string') { // maybe already a date object.
      return strDate;
    }

    if(strDate.trim() === 't') {
      return new Date();
    }

    let m = moment(strDate, this.parseDateFormats, true);
    if(looseParsing && !m.isValid()) { // Make another attempt for loose parsing.
      m = moment(strDate);
    }
    return m.isValid() ? m.toDate() : null;
  },


  /**
   * Validate date object or date string. If string, check to see if it is in acceptable formats.
   * See stringToDate() for acceptable formats.
   * @param date {Date | string} - Potential date object or date string
   * @returns boolean
   */
  isValidDate: function(date) {
    return !!(this.stringToDate(date));
  },


  /**
   * Format a date object with given format. Refer to momentjs documentation for
   * format specification.
   *
   * @param date - Date object
   * @param format - Format string
   * @returns {string}
   */
  formatDate: function(date, format) {
    return moment(date).format(format);
  },


  /**
   * Get the letter (or letters) indicator for the next repeating instance
   * The letters returned are in the pattern of:
   * 'a','b',...,'z','aa','ab',...,'az','ba','bb',...
   * for index that is:
   *  1,  2, ..., 26, 27,  28, ..., 52,  53,  54, ...
   * @param index the index for the current repeating instance, starting with 1
   */
  getNextLetter: function(index) {
    var letters = "abcdefghijklmnopqrstuvqxyz";
    var positions = [];
    var wkIndex = index;
    while (wkIndex > 0) {
      var letterIndex = wkIndex % 26;
      letterIndex = letterIndex === 0 ? 25 : letterIndex - 1;
      positions.push(letterIndex);
      wkIndex = Math.floor((wkIndex-1) / 26);
    }
    var nextLetter = "";
    for(var i=positions.length-1; i>=0; i--) {
      nextLetter += letters.charAt(positions[i]);
    }
    return nextLetter;
  },

// TODO: move to lhc-form-utils.js
  /**
   * Finds an object from an array using key/value pair with an optional start index.
   * The matching value should be a primitive type. If start index is not specified,
   * it is assumed to be 0.
   *
   * Only returns the first matched object in the array.
   *
   * @param targetObjects - Array of objects to search using key and value
   * @param key - Key of the target object to match the value.
   * @param matchingValue - Matching value of the specified key.
   * @param starting_index - Optional start index to lookup. Negative number indicates index from end.
   *   The absolute value should be less than the length of items in the array. If not
   *   the starting index is assumed to be 0.
   * @param all - If true, then an array will be returned containing all
   *  matches.
   *
   * @returns {*} - If "all" is false (default), then this returns the first matched
   *  object, or null if none matched.  If "all" is true, then this will return
   *  an array containing any matched objects.
   */
  findObjectInArray: function(targetObjects, key, matchingValue, starting_index, all) {
    var ret = all ? [] : null;
    if(Array.isArray(targetObjects)) {
      var start = 0;
      // Figure out start index.
      if(starting_index && Math.abs(starting_index) < targetObjects.length) {
        if(starting_index < 0) {
          start = targetObjects.length + starting_index;
        }
        else {
          start = starting_index;
        }
      }
      var len = targetObjects.length;
      for(var i = start; i < len; i++) {
        if(targetObjects[i][key] === matchingValue) {
          var match = targetObjects[i];
          if (all)
            ret.push(match);
          else {
            ret = match;
            break;
          }
        }
      }
    }

    return ret;
  },


  /**
   * Remove key/values from an object based on a regular expression of key.
   *
   * @param obj {object} - Object to prune
   * @param keyRegex {regex} - A regular expression to match the keys for deletion
   * @param recursiveKey {optional|string} - Key of the recursive field. The value
   *                                of this should be an object or an Array of objects.
   * @private
   */
  _pruneObject: function (keyRegex, obj, recursiveKey) {
    if(typeof obj === 'object') {
      for(var k in obj) {
        if(k.match(keyRegex)) {
          delete obj[k];
        }
        else if(recursiveKey && k === recursiveKey) {
          var val = obj[k];
          if(Array.isArray(val)) {
            var len = val.length;
            for(var i = 0; i < len; i++) {
              this._pruneObject(keyRegex, val[i], recursiveKey);
            }
          }
          else {
            this._pruneObject(keyRegex, val, recursiveKey);
          }
        }
      }
    }
  },

// TODO: move to lhc-form-utils.js
  /**
   * Utility to walkthrough recurively through each element in a collection
   *
   * @param collectionObj
   */
  pruneNulls: function (collectionObj) {
    if (Array.isArray(collectionObj)) {
      for(var i = collectionObj.length - 1; i >= 0; i--) {
        if(collectionObj[i] === null || collectionObj[i] === undefined ) {
          collectionObj.splice(i, 1);
        }
        else if(typeof collectionObj[i] === 'object') {
          this.pruneNulls(collectionObj[i]);
        }
      }
    }
    else if (collectionObj && typeof collectionObj === 'object') {
      var keys = Object.keys(collectionObj);
      keys.forEach(function (key) {
        if(collectionObj[key] === null || collectionObj[key] === undefined) {
          delete collectionObj[key];
        }
        else if (typeof collectionObj[key] === 'object') {
          this.pruneNulls(collectionObj[key]);
        }
      }, this);
    }
  },


  /**
   * deep copy of an object
   * @param {*} sourceObj an object
   * @returns an copied new object
   */
  deepCopy: function(sourceObj) {
    return copy(sourceObj);
  },

  
  /**
   * deep comparison of two objects
   * @param {*} obj1 an object
   * @param {*} obj2 an object
   * @returns 
   */
  deepEqual: function(obj1, obj2) {
    return deepEqual(obj1, obj2);
  },


  /**
   * Shallowly compares two JavaScript objects to see if their keys and values are equal.
   * @param obj1
   * @param obj2
   * @returns {boolean}
   * @private
   */
  shallowEqual: function(obj1, obj2) {
    var ret = true;

    // different type
    if (typeof obj1 !== typeof obj2 ) {
      ret = false;
    }
    // not object
    else if (typeof obj1 !== "object") {
      if (obj1 !== obj2) {
        ret = false;
      }
    }
    // object
    else {
      var keys1 = Object.keys(obj1);
      var keys2 = Object.keys(obj2);
      if (keys1.length !== keys2.length ) {
        ret = false;
      }
      else {
        // comparison from obj1 to obj2
        for (var i= 0, iLen=keys1.length; i<iLen; i++) {
          if (obj1[keys1[i]] !== obj2[keys1[i]]) {
            ret = false;
            break;
          }
        }
        // comparison from obj2 to obj1
        // is not necessary once the lengths have been checked.
      }
    }
    return ret;
  },


  /**
   *  Shows a warning message, typically about some problem with the form
   *  definition.
   * @param msg the message to show
   * @param item (optional) the item in the form to which the message applies.
   */
  showWarning: function(msg, item) {
    if (item)
      msg = 'The question "'+item.text+'" produced the following warning:  '+msg;
    console.log(msg);
    // TBD: add a warning visible on the page.
  },


  /**
   * Check if a value is an integer or if it can be correctly converted to a valid float number
   * @param {*} Value a string or numeric value to be tested
   * @returns {boolean} 
   */
  isInteger(value) {
    return Number.isInteger(value) ? true: typeof value === "number" ? false : this.intRegex.test(value);
  },


  /**
   * Check if a value is a number or if it can be correctly converted to a valid float number
   * @param {*} value a string or numeric value to be tested
   * @returns {boolean} 
   */
  isDecimal(value) {
    return typeof value === "number" ? true : this.decRegex.test(value);
  }
};

export default CommonUtils;
