/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        mustache = require("mustache"),
        page = require("app/page");
    
    var _backHtml = require("text!html/back.html"),
        _containerHtml = require("text!html/list.html"),
        _entryHtml = require("text!html/entry.html"),
        _buttonHtml = require("text!html/button.html");

    var backTemplate = mustache.compile(_backHtml),
        containerTemplate = mustache.compile(_containerHtml),
        entryTemplate = mustache.compile(_entryHtml),
        buttonTemplate = mustache.compile(_buttonHtml);

    function makeListEntry(obj, index, opts) {
        var entrySettings = {
            href: opts.getEntryHref ? opts.getEntryHref(obj, index) : null,
            tags: opts.getTags ? opts.getTags(obj, index) : null,
            highlight: opts.getHighlight ? opts.getHighlight(obj, index) : null,
            left: opts.getLeft ? opts.getLeft(obj, index) : null,
            right: opts.getRight ? opts.getRight(obj, index) : null
        },  entryHTML = entryTemplate(entrySettings),
            $entry = $(entryHTML);

        if (opts.getRemoveHref) {
            var removeHref = opts.getRemoveHref(obj),
                removeSettings = {
                    "class": "entry__remove",
                    href: removeHref,
                    title: "&times;"
                },
                removeHtml = buttonTemplate(removeSettings),
                $remove = $(removeHtml),
                removeButton = $remove.children()[0];
            
            $entry.find(".entry__right").append($remove);
            $entry.on("swipeleft", function (event) {
                var $title = $entry.find(".entry__right .entry__title"),
                    $subtitle = $entry.find(".entry__right .entry__subtitle");
                
                $title.hide();
                $subtitle.hide();
                $remove.show();
                event.stopPropagation();
                event.preventDefault();
    
                // capture-phase event listener to cancel entry clicks during removal
                document.addEventListener("click", function listener(event) {
                    if (event.target === removeButton && opts.confirmRemove(obj)) {
                        $entry.remove();
                    } else {
                        $remove.hide();
                        $title.show();
                        $subtitle.show();
                        event.preventDefault();
                    }
                    document.removeEventListener("click", listener, true);
                    event.stopPropagation();
                }, true);
            });
        }
        
        return $entry;
    }
    
    function makeListContainer(title, opts) {
        var left;
        if (opts.backHref) {
            var backSettings = {
                title: "&lsaquo;",
                href: opts.backHref
            };
            left = backTemplate(backSettings);
        } else {
            left = null;
        }
        
        var right;
        if (opts.addHref) {
            var addSettings = {
                title: "+",
                href: opts.addHref
            };
            right = buttonTemplate(addSettings);
        } else {
            right = null;
        }
        
        var containerSettings = {
            left: left,
            center: title,
            right: right
        },  containerHTML = containerTemplate(containerSettings),
            $container = $(containerHTML);
            
        return $container;
    }
    
    function showList(title, listPromise, options) {
        options = options || {};
        
        var finishedLoading = false,
            $container = makeListContainer(title, options);
        
        listPromise.done(function (list) {
            var $entries = $container.find(".entries");
            
            list.forEach(function (obj, index) {
                var $entry = makeListEntry(obj, index, options);
                $entry.css("opacity", "0.0");
                $entries.append($entry);
                $entry.animate({
                    opacity: 1.0
                }, 100 + (20 * index));
            });
        });
        
        page.showPage($container, listPromise, options.refresh, options.scroll);
    }

    exports.showList = showList;
});
