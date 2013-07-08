/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    // sunrise and sunset data for San Francisco, specified as [hours, minutes] PST
    var _astronomyText = require("text!data/astronomy.json"),
        astronomyData = JSON.parse(_astronomyText);
    
    var UTC_OFFSET_IN_MS = 1000 * 3600 * -8;
    

    
    function isDaytime() {

        var today = new Date(Date.now() + UTC_OFFSET_IN_MS),
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
