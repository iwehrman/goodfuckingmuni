/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    // sunrise and sunset data for San Francisco, specified as [hours, minutes] PST
    var _astronomyText = require("text!data/astronomy.json"),
        astronomyData = JSON.parse(_astronomyText);
    
    var UTC_OFFSET = 8 * 60; // in minutes
    
    function isDaytime() {

        var local = new Date(),
            diff = (UTC_OFFSET - local.getTimezoneOffset()),
            today = new Date(local.getTime() - (diff * 60 * 1000)),
            month = today.getMonth(),
            date = today.getDate(),
            hours = today.getHours(),
            minutes = today.getMinutes(),
            monthData = astronomyData[month],
            dateData = monthData[date],
            sunriseData = dateData[0],
            sunsetData = dateData[1],
            sunriseHours = sunriseData[0],
            sunriseMinutes = sunriseData[1],
            sunsetHours = sunsetData[0],
            sunsetMinutes = sunsetData[1];
        
        function lexicographicComparison(a1, a2) {
            return (a1 < hours || (a1 === hours && a2 <= minutes));
        }
        
        return lexicographicComparison(sunriseHours, sunriseMinutes) &&
            !lexicographicComparison(sunsetHours, sunsetMinutes);
    }
    
    return {
        isDaytime: isDaytime
    };
});
