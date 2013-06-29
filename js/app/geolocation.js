/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery"], function ($) {
    "use strict";
    
    var DEBUG = true;
    
    function getLocation() {
        var deferred = $.Deferred();
        
        if (DEBUG) {
            deferred.resolve({lat: 37.76187, lon: -122.422529});
            return deferred.promise();
        }
        
        navigator.geolocation.getCurrentPosition(function (position) {
            position.coords.lat = position.coords.latitude;
            position.coords.lon = position.coords.longitude;
            deferred.resolve(position.coords, position.timestamp);
        }, function (error) {
            console.error("Unable to geolocate: " + error);
            deferred.reject(error);
        }, {
            enableHighAccuracy: true,
            //timeout: 1000 * 60 * 1,
            maximumAge: 1000 * 60 * 10
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
    
    function formatDistance(dist) {
        if (dist < 1000) {
            return dist.toFixed(0) + "m";
        } else {
            return (dist / 1000).toFixed(1) + "km";
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
    
    return {
        distance: distance,
        formatDistance: formatDistance,
        getLocation: getLocation,
        sortByCurrentLocation: sortByCurrentLocation
    };
});
