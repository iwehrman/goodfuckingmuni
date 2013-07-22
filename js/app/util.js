/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    function filterInt(value) {
        if (/^\-?([0-9]+|Infinity)$/.test(value)) {
            return Number(value);
        }
        return NaN;
    }
    
    function castInt(value) {
        var filter = filterInt(value);
        
        return isNaN(filter) ? value : filter;
    }
    
    exports.filterInt = filterInt;
    exports.castInt = castInt;
});
