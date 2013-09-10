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
    
    function zip(list1, list2) {
        return list1.map(function (e, i) {
            return [e, list2[i]];
        });
    }
    
    function makeURL(server, props) {
        var keys = Object.keys(props),
            values = keys.map(function (k) { return encodeURIComponent(props[k]); }),
            pairs = zip(keys, values),
            terms = pairs.map(function (ar) { return ar.join("="); }),
            query = terms.join("&"),
            url = [server, query].join("?");
        
        return url;
    }
    
    exports.filterInt = filterInt;
    exports.castInt = castInt;
    exports.makeURL = makeURL;
});
