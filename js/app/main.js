/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, PathUtils */

define(["jquery", "jquery.alpha", "jquery.beta"], function ($) {
    "use strict";
    
    function commandURL(command) {
        var baseURL = "http://webservices.nextbus.com/service/publicXMLFeed?a=sf-muni";
        
        return baseURL + "&command=" + command;
    }
    
    
    function getRoutes() {
        var deferred        = $.Deferred(),
            routeUrl        = commandURL("routeList"),
            routeSettings   = {
                datatype: "xml"
            };
        
        $.ajax(routeUrl, routeSettings).done(function (data) {
            var $body   = $("body"),
                routes  = [];
            
            $(data).find("route").each(function (i, r) {
                var $route = $(r),
                    tag = $route.attr("tag"),
                    title = $route.attr("title");
                    
                routes.push({tag: tag, title: title});
            });
            deferred.resolve(routes);
        }).fail(deferred.reject);
        
        return deferred.promise();
    }
    
    var routesPromise = getRoutes();
    
    //the jquery.alpha.js and jquery.beta.js plugins have been loaded.
    $(function () {
        //$('body').alpha().beta();
        routesPromise.done(function (routes) {
            var $body = $("body"),
                $container = $("<div class='topcoat-list__container'>"),
                $header = $("<h3 class='topcoat-list__header'>Routes</h3>"),
                $list = $("<ul class='topcoat-list'></ul>");

            routes.forEach(function (route) {
                $list.append("<li class='topcoat-list__item'>" + route.title + "</li>");
            });
            
            $container.append($header).append($list);
            $body.append($container);

        });
    });
    
    
});