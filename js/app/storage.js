/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery"], function ($) {
    "use strict";
    
    var STOPS_KEY = "org.wehrman.goodfuckingmuni.stops";
    
    function getAllStoredStops(routeTag, directionTag) {
        var storeJSON = localStorage.getItem(STOPS_KEY),
            store = storeJSON ? JSON.parse(storeJSON) : {};
        
        if (!store[routeTag]) {
            store[routeTag] = {};
        }
        
        if (!store[routeTag][directionTag]) {
            store[routeTag][directionTag] = {};
        }
        
        return store;
    }
    
    function getStoredStops(routeTag, directionTag) {
        var store = getAllStoredStops(routeTag, directionTag);
        
        return store[routeTag][directionTag];
    }
    
    function updateStoredStop(routeTag, directionTag, callback) {
        var store = getAllStoredStops(routeTag, directionTag);
        
        callback(store[routeTag][directionTag]);
        
        localStorage.setItem(STOPS_KEY, JSON.stringify(store));
    }
    
    function rememberStop(routeTag, directionTag, stopTag) {
        var _store;
        updateStoredStop(routeTag, directionTag, function (store) {
            store[stopTag] = true;
            _store = store;
        });
        return _store;
    }
    
    function forgetStop(routeTag, directionTag, stopTag) {
        var _store;
        updateStoredStop(routeTag, directionTag, function (store) {
            if (store[stopTag]) {
                delete store[stopTag];
            }
            _store = store;
        });
        return _store;
    }
    
    
    return {
        getStoredStops: getStoredStops,
        rememberStop: rememberStop,
        forgetStop: forgetStop
    };
});