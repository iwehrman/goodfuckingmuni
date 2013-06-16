/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "app/storage", "app/command"], function ($, storage, command) {
    "use strict";
    
    var $body = $("body"),
        $stops = $body.find(".content-stops"),
        $directions = $body.find(".content-directions"),
        $routelist = $body.find(".content-routes"),
        routesPromise;
        
    function showStopsForDirection(route, dirTag) {
        var direction = route.directions[dirTag],
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + direction.title + "</h2>"),
            $list = $("<ul class='topcoat-list'></ul>"),
            storedStops = storage.getStoredStops(route.tag, dirTag);
        
        function normalizeDist(direction, stop) {
            var range = direction.maxDist - direction.minDist,
                fromMin = stop.dist - direction.minDist;
            
            return 1 - (fromMin / range);
        }
        
        direction.stops.forEach(function (stopTag) {
            var stop = route.stops[stopTag],
                norm = normalizeDist(direction, stop),
                $item = $("<li class='topcoat-list__item entry-stop' data-tag='" +
                          stopTag + "'>"),
                $text = $("<span>").append(stop.title);
            
            if (norm === 1) {
                $text.addClass("closest");
            }
            
            if (storedStops[stopTag]) {
                $text.addClass("stored");
            }
            
            $item.on("click", function () {
                if (storedStops[stopTag]) {
                    $text.removeClass("stored");
                    storedStops = storage.forgetStop(route.tag, dirTag, stopTag);
                } else {
                    $text.addClass("stored");
                    storedStops = storage.rememberStop(route.tag, dirTag, stopTag);
                }
                command.getPredictions(route.tag, stopTag).done(function (predictions) {
                    console.log(predictions);
                });
            });
            
            $item.append($text);
            $list.append($item);
        });
        
        $container.append($header).append($list);
        $stops.append($container);
        $stops.show();
        
        $body.animate({
            scrollTop: $list.find(".closest").parent().offset().top - $body.scrollTop()
        });
        
        var stateObj = { route: route, direction: dirTag };
        history.pushState(stateObj, undefined, "#route=" + route.tag + "&direction=" + dirTag);
    }
    
    function showDirections(routes, route) {
        var $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + route.title + "</h2>"),
            $list = $("<ul class='topcoat-list route-directions'></ul>"),
            direction,
            tag;
        
        for (tag in route.directions) {
            if (route.directions.hasOwnProperty(tag)) {
                direction = route.directions[tag];
                
                $list.append("<li class='topcoat-list__item entry-direction' data-tag='" +
                         tag + "'>" + direction.title + "</li>");
            }
        }
        
        $container.append($header).append($list);
        $directions.append($container);
        $directions.show();
        
        var stateObj = { routes: routes, route: route };
        history.pushState(stateObj, "Route: " + route.title, "#route=" + route.tag);
        
        $directions.find(".entry-direction").each(function (i, d) {
            var $direction = $(d),
                tag = $direction.data("tag");
            
            $direction.on("click", function () {
                $directions.hide();
                $directions.empty();
                showStopsForDirection(route, tag);
            });
        });
    }

    function showRoutes(routes) {
        var $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>Routes</h2>"),
            $list = $("<ul class='topcoat-list'></ul>");

        routes.forEach(function (route) {
            $list.append("<li class='topcoat-list__item entry-route' data-tag='" +
                         route.tag + "'>" + route.title + "</li>");
        });
        
        $container.append($header).append($list);
        $routelist.append($container);
        $routelist.show();
        history.pushState({ routes: routes }, "Routes", "/");
        
        $routelist.find(".entry-route").each(function (i, r) {
            var $route = $(r),
                tag = $route.data("tag");
            
            $route.on("click", function () {
                command.getRoute(tag).done(function (route) {
                    $routelist.hide();
                    $routelist.empty();
                    showDirections(routes, route);
                });
            });
        });
    }
    
    window.onpopstate = function (event) {
        var state = event.state;
        
        if (state.route) {
            $stops.hide();
            $stops.empty();
            history.pushState({ routes: state.routes }, "Routes", "/");
            showDirections(state.routes, state.route);
        } else if (state.routes) {
            $directions.hide();
            $directions.empty();
            showRoutes(state.routes);
        }
    };
    
    routesPromise = command.getRoutes();

    $(function () {
        //$('body').alpha().beta();
        routesPromise.done(showRoutes);
    });
    
});