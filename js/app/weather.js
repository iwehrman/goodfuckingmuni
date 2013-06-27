/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "app/geolocation"], function ($, geolocation) {
    "use strict";
    
    function getWeatherForCurrentPosition() {
        
        var deferred = $.Deferred();
        
        function getWeatherData(lat, lon, callback) {
            var url = "http://api.openweathermap.org/data/2.5/weather?lat=" + lat + "&lon=" + lon,
                settings = {
                    dataType: "jsonp",
                    success: deferred.resolve.bind(deferred),
                    fail: deferred.reject.bind(deferred)
                };
            
            return $.ajax(url, settings);
        }
        
        geolocation.getLocation().done(function (coords) {
            getWeatherData(coords.lat, coords.lon)
                .fail(deferred.reject.bind(deferred));
        });
        
        return deferred.promise();
    }
    
    function isDaytime() {
        var deferred = $.Deferred();
        
        getWeatherForCurrentPosition().done(function (data) {
            var now = Date.now(),
                sunrise = data.sys.sunrise * 1000,
                sunset = data.sys.sunset * 1000;
            
            if (sunrise <= now && now <= sunset) {
                deferred.resolve(true);
            } else {
                deferred.resolve(false);
            }
        }).fail(function () {
            var now = new Date(),
                hours = now.getHours();
            
            if (6 <= hours && hours <= 20) {
                deferred.resolve(true);
            } else {
                deferred.resolve(false);
            }
        });
        
        return deferred.promise();
    }
    
    return {
        isDaytime: isDaytime
    };
});
