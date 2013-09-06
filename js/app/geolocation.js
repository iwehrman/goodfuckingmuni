/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery");
    
    var WALKING_SPEED_IN_KM_PER_SEC = 0.0014;
        
    function getLocation() {
        var deferred = $.Deferred();
        
        navigator.geolocation.getCurrentPosition(function (position) {
            position.coords.lat = position.coords.latitude;
            position.coords.lon = position.coords.longitude;
            deferred.resolve(position.coords, position.timestamp);
        }, function (error) {
            console.error("Unable to geolocate: " + error);
            deferred.reject(error);
        }, {
            enableHighAccuracy: true,
            timeout: 1000 * 10,
            maximumAge: 1000 * 60
        });
        
        return deferred.promise();
    }

    function distance(pos1, pos2) {
        function toRad(x) {
            return x * Math.PI / 180;
        }
        
        var lat1 = pos1.lat,
            lat2 = pos2.lat,
            lon1 = pos1.lon,
            lon2 = pos2.lon;
        
        var R = 6371; // Radius of the earth in km
        var dLat = toRad(lat2 - lat1);  // Javascript functions in radians
        var dLon = toRad(lon2 - lon1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        
        return d;
    }
    
    function kilometersToMiles(km) {
        var meters = km * 1000,
            miles = meters / 1609.344,
            fixed = miles.toFixed(1);
        
        if (fixed.indexOf(".0") > 0) {
            return miles.toFixed(0);
        } else {
            return fixed;
        }
    }
    
    function positionComparator(main) {
        return function (pos1, pos2) {
            var dist1 = distance(main, pos1),
                dist2 = distance(main, pos2);
            
            return dist1 - dist2;
        };
    }
    
    function sortByCurrentLocation(array) {
        var deferred = $.Deferred();
        
        getLocation().done(function (coords) {
            array.sort(positionComparator(coords));
            deferred.resolve(coords);
        }).fail(deferred.reject.bind(deferred));
        
        return deferred.promise();
    }
    
    function walkTime(km) {
        return km / WALKING_SPEED_IN_KM_PER_SEC;
    }
    
    return {
        distance: distance,
        kilometersToMiles: kilometersToMiles,
        getLocation: getLocation,
        sortByCurrentLocation: sortByCurrentLocation,
        walkTime: walkTime
    };
});
