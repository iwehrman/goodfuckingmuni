/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "app/storage", "app/command"], function ($, storage, command) {
    "use strict";
    
    var $body = $("body"),
        $stops = $body.find(".content-stops"),
        $directions = $body.find(".content-directions"),
        $routelist = $body.find(".content-routes"),
        $predictions = $body.find(".content-predictions"),
        routesPromise;
    
    function showPredictions(routes, route, dirTag, stopTag, predictions) {
        var stop = route.stops[stopTag],
            direction = route.directions[dirTag],
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + route.title +
                        " &gt; " + direction.title + " &gt; " + stop.title + "</h2>"),
            $list = $("<ul class='topcoat-list'></ul>");
        
        predictions.forEach(function (prediction, index) {
            var $item = $("<li class='topcoat-list__item entry-prediction'>"),
                $text = $("<span>").append(prediction.minutes + " minutes");
            
            if (index === 0) {
                $text.addClass("closest");
            }
            
            $item.append($text);
            $list.append($item);
        });
        
        $container.append($header).append($list);
        $predictions.append($container);
        $predictions.show();
    }
        
    function showStops(routes, route, dirTag) {
        var direction = route.directions[dirTag],
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + route.title +
                        " &gt; " + direction.title + "</h2>"),
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
                    var stateObj = { routes: routes, route: route, dirTag: dirTag, stopTag: stopTag };
                    history.pushState(stateObj, null, "#r=" + route.tag + "&d=" + dirTag + "&s=" + stopTag);
                    
                    $stops.hide();
                    $stops.empty();
                    showPredictions(routes, route, dirTag, stopTag, predictions);
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
    }
    
    function showDirections(routes, route) {
        var $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + route.title + "</h2>"),
            $list = $("<ul class='topcoat-list route-directions'></ul>"),
            direction,
            dirTag;
        
        for (dirTag in route.directions) {
            if (route.directions.hasOwnProperty(dirTag)) {
                direction = route.directions[dirTag];
                
                $list.append("<li class='topcoat-list__item entry-direction' data-tag='" +
                         dirTag + "'>" + direction.title + "</li>");
            }
        }
        
        $container.append($header).append($list);
        $directions.append($container);
        $directions.show();
        
        $directions.find(".entry-direction").each(function (i, d) {
            var $direction = $(d),
                dirTag = $direction.data("tag");
            
            $direction.on("click", function () {
                var stateObj = { routes: routes, route: route, dirTag: dirTag };
                history.pushState(stateObj, null, "#r=" + route.tag + "&d=" + dirTag);
                
                $directions.hide();
                $directions.empty();
                showStops(routes, route, dirTag);
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
        
        $routelist.find(".entry-route").each(function (i, r) {
            var $route = $(r),
                tag = $route.data("tag");
            
            $route.on("click", function () {
                command.getRoute(tag).done(function (route) {
                    var stateObj = { routes: routes, route: route };
                    history.pushState(stateObj, null, "#r=" + route.tag);
                    
                    $routelist.hide();
                    $routelist.empty();
                    showDirections(routes, route);
                });
            });
        });
        
        
    }
    
    window.onpopstate = function (event) {
        var state = event.state;

        if (state) {
            if (state.dirTag) {
                $predictions.hide();
                $predictions.empty();
                showStops(state.routes, state.route, state.dirTag);
            } else if (state.route) {
                $stops.hide();
                $stops.empty();
                showDirections(state.routes, state.route);
            } else if (state.routes) {
                $directions.hide();
                $directions.empty();
                showRoutes(state.routes);
            }
        }
    };
    
    routesPromise = command.getRoutes();

    $(function () {
        //$('body').alpha().beta();
        
        routesPromise.done(function (routes) {
            var stateObj = { routes: routes };
            history.pushState(stateObj, null, "");
            showRoutes(routes);
        });
    });
    
});
