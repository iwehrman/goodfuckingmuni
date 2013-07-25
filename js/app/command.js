/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery");

    var MAX_RETRIES = 5,
        HTTP_TIMEOUT = 5000;
    
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
            var routeUrl    = commandURL.apply(null, arguments),
                promise     = cachedPromises[routeUrl],
                deferred,
                settings,
                retries;
            
            function ajaxHelper() {
                $.ajax(routeUrl, settings)
                    .done(function () {
                        delete cachedPromises[routeUrl];
                        deferred.resolve.apply(deferred, arguments);
                    })
                    .fail(function (jqXHR, textStatus, errorThrown) {
                        console.error("Command " + commandName + " failed: " + textStatus);
                        if (++retries < MAX_RETRIES) {
                            ajaxHelper();
                        } else {
                            delete cachedPromises[routeUrl];
                            deferred.reject.apply(deferred, arguments);
                        }
                    });
            }
            
            
            if (!promise) {
                deferred = $.Deferred();
                retries = 0;
                settings = {
                    datatype: "xml",
                    timeout: 5000
                };
                
                promise = deferred.promise();
                cachedPromises[routeUrl] = promise;
                ajaxHelper();
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
