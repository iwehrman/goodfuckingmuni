/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, PathUtils */

define(["jquery", "jquery.alpha", "jquery.beta"], function ($) {
    "use strict";
    
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
                directions  = [],
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
                
                directions.push({
                    tag:    tag,
                    title:  title,
                    name:   name,
                    stops:  stops
                });
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
    
    function showRoute(route, $prev) {
        var $body = $("body"),
            $detail = $body.find(".route-detail"),
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + route.title + "</h2>"),
            $list = $("<ul class='topcoat-list route-directions'></ul>");
        
        route.directions.forEach(function (direction) {
            $list.append("<li class='topcoat-list__item route-name' data-tag='" +
                         direction.tag + "'>" + direction.title + "</li>");
        });
        
        $container.append($header).append($list);
        $detail.append($container);
        $prev.hide();
        $detail.show();
    }
    
    var routesPromise = getRoutes();
    
    //the jquery.alpha.js and jquery.beta.js plugins have been loaded.
    $(function () {
        //$('body').alpha().beta();
        routesPromise.done(function (routes) {
            var $body = $("body"),
                $routelist = $body.find(".route-list"),
                $container = $("<div class='topcoat-list__container'></div>"),
                $header = $("<h2 class='topcoat-list__header'>Routes</h2>"),
                $list = $("<ul class='topcoat-list route-names'></ul>");

            routes.forEach(function (route) {
                $list.append("<li class='topcoat-list__item route-name' data-tag='" +
                             route.tag + "'>" + route.title + "</li>");
            });
            
            $container.append($header).append($list);
            $routelist.append($container);
            
            $routelist.find(".route-name").each(function (i, r) {
                var $route = $(r),
                    tag = $route.data("tag");
                
                $route.on("click", function () {
                    getRoute(tag).done(function (route) {
                        showRoute(route, $body.find(".route-list"));
                    });
                });
            });
        });
    });
    
    
});