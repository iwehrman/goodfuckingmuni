/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var view = require("app/view"),
        places = require("app/places");
        
    function addPlace() {
        var deferred = $.Deferred(),
            name = window.prompt("Place name: ", "");
        
        if (name) {
            places.addPlace(name).done(function (place) {
                deferred.resolve(place);
            }).fail(function (err) {
                deferred.reject(err);
            });
        } else {
            deferred.reject();
        }
        
        return deferred.promise();
    }
    
    function removePlace(placeId) {
        var place = places.getPlace(placeId);
        places.removePlace(place);
    }
    
    function addStop(placeId, routeTag, dirTag, stopTag) {
        var place = places.getPlace(placeId);
        place.addStop(routeTag, dirTag, stopTag);
    }
    
    function removeStop(placeId, stopTag) {
        var place = places.getPlace(placeId);
        place.removeStop(stopTag);
    }
    
    function loadPage(page) {
        var args = Array.prototype.slice.call(arguments, 0),
            params = args.length > 1 ? args.slice(1) : [],
            stateObj = {};
        
        switch (page) {
        case "places":
            view.showPlaces.apply(null, params);
            break;
        case "addPlace":
            addPlace().done(function (place) {
                stateObj.place = place.id;
                history.pushState(stateObj, null, "#p=" + place.id);
                view.showPlace(place.id);
            });
            break;
        case "removePlace":
            params[0] = parseInt(params[0], 10);
            removePlace(params[0]);
            break;
        case "place":
            params[0] = parseInt(params[0], 10);
            stateObj.place = params[0];
            history.pushState(stateObj, null, "#p=" + params[0]);
            view.showPlace.apply(null, params);
            break;
        case "routes":
            params[0] = parseInt(params[0], 10);
            stateObj.place = params[0];
            history.pushState(stateObj, null, "#p=" + params[0] + "&o=add");
            view.showRoutes.apply(null, params);
            break;
        case "directions":
            params[0] = parseInt(params[0], 10);
            stateObj.place = params[0];
            stateObj.route = params[1];
            history.pushState(stateObj, null, "#p=" + params[0] + "&o=add&r=" + params[1]);
            view.showDirections.apply(null, params);
            break;
        case "stops":
            params[0] = parseInt(params[0], 10);
            params.push(true);
            stateObj.place = params[0];
            stateObj.route = params[1];
            stateObj.dir = params[2];
            history.pushState(stateObj, null, "#p=" + params[0] + "&o=add&r=" + params[1] + "&d=" + params[2]);
            view.showStops.apply(null, params);
            break;
        case "addStop":
            params[0] = parseInt(params[0], 10);
            addStop.apply(null, params);
            stateObj.place = params[0];
            history.pushState(stateObj, null, "#p=" + params[0]);
            view.showPlace(params[0]);
            break;
        case "removeStop":
            params[0] = parseInt(params[0], 10);
            removeStop.apply(null, params);
            break;
        case "predictions":
            view.showPredictions.apply(null, params);
            break;
        default:
            break;
        }
    }
    
    function getStateFromHash() {
        function filterInt(value) {
            if (/^\-?([0-9]+|Infinity)$/.test(value)) {
                return Number(value);
            }
	        return NaN;
        }
        
        var hash = window.location.hash,
            params;
        
        if (hash) {
            params = hash.substring(1).split("&").reduce(function (obj, eq) {
                var terms = eq.split("="),
                    key = terms[0],
                    val = terms[1],
                    filteredVal = filterInt(val),
                    castVal = isNaN(filteredVal) ? val : filteredVal;
                    
                obj[key] = castVal;
                return obj;
            }, {});
        } else {
            params = {};
        }
        
        return params;
    }
    
    function getHashFromState(state) {
        var hash = "#",
            key;
        
        if (state.page) {
            hash += "page=" + state.page;
            
            for (key in state) {
                if (state.hasOwnProperty(key) && key !== "page") {
                    hash += "&" + key + "=" + state[key];
                }
            }
        }
        
        return hash;
    }
    
    function loadFromHashParams() {
        var params = getStateFromHash();
        if (params.p) {
            view.showPlace(parseInt(params.p, 10));
        } else {
            if (params.r) {
                if (params.d) {
                    if (params.s) {
                        view.showPredictions(params.r, params.d, params.s);
                    } else {
                        view.showStops(params.r, params.d, true);
                    }
                } else {
                    view.showDirections(params.r);
                }
            } else {
                view.showPlaces();
            }
        }
    }
        
//    window.onpopstate = function (event) {
//        var state = event.state;
//
//        if (state) {
//            if (state.place !== null) {
//                view.showPlace(state.place);
//                return;
//            } else if (state.route !== null && state.dir !== null && state.stop !== null) {
//                view.showPredictions(state.route, state.dir, state.stop);
//                return;
//            }
//        }
//        view.showPlaces();
//    };
    
    function loadPageFromState(state) {
        switch (state.page) {
        case "places":
            if (state.op === "add") {
                addPlace().done(function (place) {
                    location.hash = "#page=place&place=" + place.id;
                });
            } else {
                view.showPlaces(true);
            }
            break;
        case "place":
            view.showPlace(state.place);
            break;
        case "predictions":
            view.showPredictions(state.route, state.stop, state.place);
            break;
        default:
            view.showPlaces(false);
        }
    }
    
    window.onhashchange = function (event) {
        var state = getStateFromHash();

        loadPageFromState(state);
    };
    
    return {
        loadPage: loadPage,
        loadFromHashParams: loadFromHashParams
    };
});
