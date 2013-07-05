/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        geo = require("app/geolocation");
    
    var WEATHER_KEY = "org.wehrman.goodfuckingmuni.weather",
        APPID = "ec87b4f14ec1d073e89fc326f16b27c7";
    
    function getWeatherForCurrentPosition() {
        var deferred = $.Deferred();

        function getWeatherData(lat, lon) {
            var baseUrl = "http://api.openweathermap.org/data/2.5/weather",
                url = baseUrl + "?APPID=" + APPID + "&lat=" + lat + "&lon=" + lon,
                callback = ("callback" + lat + lon).replace(/\./g, "d").replace(/-/g, "m"),
                settings = {
                    dataType: "jsonp",
                    cache: true,
                    jsonpCallback: callback,
                    //success: deferred.resolve.bind(deferred),
                    fail: deferred.reject.bind(deferred)
                };
            
            window[callback] = function (data) {
                deferred.resolve(data);
                delete window[callback];
            };
            
            return $.ajax(url, settings);
        }
        
        geo.getLocation().done(function (coords) {
            getWeatherData(coords.lat, coords.lon)
                .fail(deferred.reject.bind(deferred));
        });
        
        return deferred.promise();
    }
    
    function isDaytime() {
        var deferred = $.Deferred();
        
        function handleWeatherData(data) {
            var now = Date.now(),
                sunrise = data.sys.sunrise * 1000,
                sunset = data.sys.sunset * 1000,
                midnight = Date.parse();
            
            localStorage.setItem(WEATHER_KEY, data);
            
            setTimeout(function () {
                localStorage.removeItem(WEATHER_KEY);
            });
            
            if (sunrise <= now && now <= sunset) {
                deferred.resolve(true);
            } else {
                deferred.resolve(false);
            }
        }
        
        var weather = localStorage.getItem(WEATHER_KEY);
        
        if (weather) {
            handleWeatherData(weather);
        } else {
            getWeatherForCurrentPosition().done(handleWeatherData).fail(function () {
                var now = new Date(),
                    hours = now.getHours();
                
                if (6 <= hours && hours <= 20) {
                    deferred.resolve(true);
                } else {
                    deferred.resolve(false);
                }
            });
        }
        
        
        
        return deferred.promise();
    }
    
    return {
        isDaytime: isDaytime
    };
});
