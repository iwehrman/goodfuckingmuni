/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        astronomy = require("app/astronomy"),
        controller = require("app/controller"),
        view = require("app/view");
    
    require("jquery.event.move");
    require("jquery.event.swipe");

    $(view).on("navigate", function (event) {
        if (arguments.length > 1) {
            var params = Array.prototype.slice.call(arguments, 1);

            controller.loadPage.apply(null, params);
        }
    });
    
    window.onpopstate = function (event) {
        var state = event.state;

        if (state) {
            if (state.place !== null) {
                view.showPlace(state.place);
            } else if (state.dir !== null) {
                view.showStops(state.routeTag, state.dir);
            } else if (state.route !== null) {
                view.showDirections(state.route);
            }
        } else {
            view.showPlaces();
        }
    };
    
    function loadStylesheet() {
        var link;
        if (astronomy.isDaytime()) {
            link = "<link rel='stylesheet' type='text/css' href='css/topcoat-mobile-light.min.css'>";
        } else {
            link = "<link rel='stylesheet' type='text/css' href='css/topcoat-mobile-dark.min.css'>";
        }
        $("head").append(link);
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

    loadStylesheet();
    
    $(function () {
        loadFromHashParams();
        
        $("html").on("swiperight", function (e) {
            if (history.state) {
                window.history.back();
            }
        });
    });
});
