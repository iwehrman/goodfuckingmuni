/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, PathUtils */

define(["jquery", "jquery.alpha", "jquery.beta"], function ($) {
    "use strict";
    
    var $body = $("body"),
        $stops = $body.find(".content-stops"),
        $directions = $body.find(".content-directions"),
        $routelist = $body.find(".content-routes");
    
    function commandURL(command) {
        var baseURL = "http://webservices.nextbus.com/service/publicXMLFeed?a=sf-muni",
            fullURL = baseURL + "&command=" + command;
        
        if (arguments.length > 1) {
            var params  = Array.prototype.slice.call(arguments, 1),
                query   = params.map(function (param) {
                    var key = encodeURIComponent(param[0]),
                        val = encodeURIComponent(param[1]);
                    return key + "=" + val;
                }).join("&");
            fullURL += "&" + query;
        }
        return fullURL;
    }
    
    
    function getRoutes() {
        var deferred        = $.Deferred(),
            routeUrl        = commandURL("routeList"),
            routeSettings   = {
                datatype: "xml"
            };
        
        $.ajax(routeUrl, routeSettings).done(function (data) {
            var routes  = [];
            
            $(data).find("route").each(function (i, r) {
                var $route  = $(r),
                    tag     = $route.attr("tag"),
                    title   = $route.attr("title");
                    
                routes.push({tag: tag, title: title});
            });
            deferred.resolve(routes);
        }).fail(deferred.reject);
        
        return deferred.promise();
    }
    
    function getRoute(tag) {
        var deferred        = $.Deferred(),
            routeURL        = commandURL("routeConfig", ["r", tag]),
            routeSettings   = {
                datatype: "xml"
            };
        
        $.ajax(routeURL, routeSettings).done(function (data) {
            var $data       = $(data),
                $route      = $data.find("route"),
                tag         = $route.attr("tag"),
                title       = $route.attr("title"),
                color       = $route.attr("color"),
                opposite    = $route.attr("oppositeColor"),
                directions  = {},
                stops       = {};
            
            $route.children("stop").each(function (i, s) {
                var $stop   = $(s),
                    tag     = $stop.attr("tag"),
                    title   = $stop.attr("title");
                
                stops[tag] = title;
            });
            
            $route.children("direction").each(function (i, d) {
                var $direction = $(d),
                    tag = $direction.attr("tag"),
                    title = $direction.attr("title"),
                    name = $direction.attr("name"),
                    stops = [];
                
                $direction.children("stop").each(function (i, s) {
                    var $stop = $(s),
                        stopTag = $stop.attr("tag");
                    
                    stops.push(stopTag);
                });
                
                directions[tag] = {
                    title:  title,
                    name:   name,
                    stops:  stops
                };
            });
            
            deferred.resolve({
                tag:            tag,
                title:          title,
                color:          color,
                oppositeColor:  opposite,
                directions:     directions,
                stops:          stops
            });
            
        }).fail(deferred.reject);
        
        return deferred.promise();
    }
    
    function showStopsForDirection(route, tag) {
        var direction = route.directions[tag],
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + direction.title + "</h2>"),
            $list = $("<ul class='topcoat-list'></ul>");
            
        
        direction.stops.forEach(function (stopTag) {
            $list.append("<li class='topcoat-list__item entry-stop' data-tag='" +
                         stopTag + "'>" + route.stops[stopTag] + "</li>");
        });
        
        $container.append($header).append($list);
        $stops.append($container);
        $stops.show();
        
        var stateObj = { route: route, direction: tag };
        history.pushState(stateObj, "Route: " + route.title, "#route=" + route.tag + "&direction=" + tag);
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
                getRoute(tag).done(function (route) {
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
    
    var routesPromise = getRoutes();
    
    $(function () {
        //$('body').alpha().beta();
        routesPromise.done(showRoutes);
    });
    
});