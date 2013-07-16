/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery");

    var cachedPromises = {};
    
    function defineCommand(commandName, args) {
        function commandURL() {
            var baseURL = "http://webservices.nextbus.com/service/publicXMLFeed?a=sf-muni",
                fullURL = baseURL + "&command=" + commandName;
            
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
        
        function doCommand() {
            var routeUrl        = commandURL.apply(null, arguments),
                promise         = cachedPromises[routeUrl];
            
            if (!promise) {
                var settings = { datatype: "xml" };
                promise = $.ajax(routeUrl, settings)
                    .always(function () {
                        delete cachedPromises[routeUrl];
                    })
                    .fail(function (jqXHR, textStatus, errorThrown) {
                        console.error("Command " + commandName + " failed: " + textStatus);
                    });
            }
            
            return promise;
        }
        
        return function () {
            var vals = Array.prototype.slice.apply(arguments),
                params = vals.map(function (val, index) {
                    // zip params and arguments
                    return [args[index], val];
                }).reduce(function (prev, next) {
                    // expand array arguments
                    var arg = next[0],
                        valArray = [].concat(next[1]);
                    
                    valArray.forEach(function (val) {
                        prev.push([arg, val]);
                    });
                    return prev;
                }, []);
            
            params.unshift(commandName);
            return doCommand.apply(null, params);
        };
    }
    
    exports.defineCommand = defineCommand;
});
