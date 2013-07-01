/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        async = require("async"),
        command = require("app/command"),
        places = require("app/places"),
        geo = require("app/geolocation"),
        weather = require("app/weather"),
        view = require("app/view");

    var $body = $("body"),
        $places = $body.find(".content-places"),
        $placeStops = $body.find(".content-places"),
        $routeStops = $body.find(".content-route-stops"),
        $directions = $body.find(".content-directions"),
        $routes = $body.find(".content-routes"),
        $predictions = $body.find(".content-predictions");
    
    window.onpopstate = function (event) {
        var state = event.state;

        if (state) {
            if (state.placeId !== null) {
                $predictions.hide();
                $predictions.empty();
                view.showPlace(state.placeId);
            } else if (state.dirTag !== null) {
                $predictions.hide();
                $predictions.empty();
                view.showStops(state.routeTag, state.dirTag);
            } else if (state.routeTag !== null) {
                $routeStops.hide();
                $routeStops.empty();
                view.showDirections(state.routeTag);
            }
        } else {
            $placeStops.hide();
            $placeStops.empty();
            view.showPlaces();
        }
    };
    
    function loadDarkStylesheet() {
        weather.isDaytime().done(function (daytime) {
            if (!daytime) {
                var $link = $("<link rel='stylesheet' type='text/css' href='css/topcoat-mobile-dark.min.css'>");
                $body.append($link);
            }
        });
    }
    
    function getHashParams() {
        var hash = window.location.hash,
            params;
        
        if (hash) {
            params = hash.substring(1).split("&").reduce(function (obj, eq) {
                var terms = eq.split("=");
                obj[terms[0]] = terms[1];
                return obj;
            }, {});
        } else {
            params = {};
        }
        
        return params;
    }
    
    function loadFromHashParams() {
        var params = getHashParams();
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

    $(function () {
        loadDarkStylesheet();
        loadFromHashParams();
    });
});
